"""
Newsroom Flask app
------------------

This module implements WSGI application extending eve.Eve
"""

import os
import pathlib
import importlib

import eve
import flask
import newsroom

from flask_mail import Mail
from flask_caching import Cache
from superdesk.storage import AmazonMediaStorage, SuperdeskGridFSMediaStorage
from superdesk.datalayer import SuperdeskDataLayer
from superdesk.json_utils import SuperdeskJSONEncoder
from superdesk.validator import SuperdeskValidator
from superdesk.logging import configure_logging

from newsroom.auth import SessionAuth
from newsroom.utils import is_json_request
from newsroom.gettext import setup_babel


NEWSROOM_DIR = pathlib.Path(__file__).resolve().parent.parent


class BaseNewsroomApp(eve.Eve):
    """The base Newsroom app class"""

    DATALAYER = SuperdeskDataLayer
    AUTH_SERVICE = SessionAuth
    INSTANCE_CONFIG = None

    def __init__(self, import_name=__package__, config=None, testing=False, **kwargs):
        """Override __init__ to do Newsroom specific config and still be able
        to create an instance using ``app = Newsroom()``
        """

        self._testing = testing
        self._general_settings = {}
        self.babel_tzinfo = None
        self.babel_locale = None
        self.babel_translations = None
        self.mail = None
        self.cache = None
        self.static_folder = None

        super(BaseNewsroomApp, self).__init__(
            import_name,
            data=self.DATALAYER,
            auth=self.AUTH_SERVICE,
            template_folder=os.path.join(NEWSROOM_DIR, 'templates'),
            static_folder=os.path.join(NEWSROOM_DIR, 'static'),
            validator=SuperdeskValidator,
            **kwargs
        )
        self.json_encoder = SuperdeskJSONEncoder
        self.data.json_encoder_class = SuperdeskJSONEncoder

        if config:
            try:
                self.config.update(config or {})
            except TypeError:
                self.config.from_object(config)

        newsroom.flask_app = self
        self.settings = self.config

        self.setup_media_storage()
        self.setup_babel()
        self.setup_blueprints(self.config['BLUEPRINTS'])
        self.setup_apps(self.config['CORE_APPS'])
        if not self.config.get("BEHAVE"):
            # workaround for core 2.3 adding planning to installed apps
            self.setup_apps(self.config.get('INSTALLED_APPS', []))
        self.setup_email()
        self.setup_cache()
        self.setup_error_handlers()

        configure_logging(self.config.get('LOG_CONFIG_FILE'))

    def load_app_default_config(self):
        """
        Loads default app configuration
        """
        self.config.from_object('content_api.app.settings')

    def load_app_instance_config(self):
        """
        Loads instance configuration defined on the newsroom-app repo level
        """
        if not self._testing and self.INSTANCE_CONFIG:
            try:
                self.config.from_pyfile(os.path.join(os.getcwd(), self.INSTANCE_CONFIG))
            except FileNotFoundError:
                pass

    def load_config(self):
        # Override Eve.load_config in order to get default_settings

        if not getattr(self, 'settings'):
            self.settings = flask.Config('.')

        super(BaseNewsroomApp, self).load_config()
        self.config.setdefault('DOMAIN', {})
        self.config.setdefault('SOURCES', {})
        self.load_app_default_config()
        self.load_app_instance_config()

    def setup_media_storage(self):
        if self.config.get('AMAZON_CONTAINER_NAME'):
            self.media = AmazonMediaStorage(self)
        else:
            self.media = SuperdeskGridFSMediaStorage(self)

    def setup_babel(self):
        self.config.setdefault(
            'BABEL_TRANSLATION_DIRECTORIES',
            os.path.join(NEWSROOM_DIR, 'translations')
        )
        # avoid events on this
        self.babel_tzinfo = None
        self.babel_locale = None
        self.babel_translations = None
        setup_babel(self)

    def setup_blueprints(self, modules):
        """Setup configured blueprints."""
        for name in modules:
            mod = importlib.import_module(name)

            if getattr(mod, 'blueprint'):
                self.register_blueprint(mod.blueprint)

    def setup_apps(self, apps):
        """Setup configured apps."""
        for name in apps:
            mod = importlib.import_module(name)
            if hasattr(mod, 'init_app'):
                mod.init_app(self)

    def setup_email(self):
        self.mail = Mail(self)

    def setup_cache(self):
        self.cache = Cache(self)

    def setup_error_handlers(self):
        def assertion_error(err):
            return flask.jsonify({'error': err.args[0] if err.args else 1}), 400

        def render_404(err):
            if flask.request and is_json_request(flask.request):
                return flask.jsonify({'code': 404}), 404
            return flask.render_template('404.html'), 404

        def render_403(err):
            if flask.request and is_json_request(flask.request):
                return flask.jsonify({'code': 403, 'error': str(err), 'info': getattr(err, 'description', None)}), 403
            return flask.render_template('403.html'), 403

        self.register_error_handler(AssertionError, assertion_error)
        self.register_error_handler(404, render_404)
        self.register_error_handler(403, render_403)

    def general_setting(self, _id, label, type='text', default=None,
                        weight=0, description=None, min=None, client_setting=False):
        self._general_settings[_id] = {
            'type': type,
            'label': label,
            'weight': weight,
            'default': default,
            'description': description,
            'min': min,
            'client_setting': client_setting
        }

        if flask.g:  # reset settings cache
            flask.g.settings = None
