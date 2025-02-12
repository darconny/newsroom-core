import React from 'react';
import PropTypes from 'prop-types';
import {characterCount, wordCount} from 'utils';
import {getCaption, getPicture, getThumbnailRendition} from 'wire/utils';
import CardFooter from './CardFooter';
import CardBody from './CardBody';
import CardRow from './CardRow';

const getPictureTextPanel = (item, picture, openItem, cardId, listConfig) => {
    const rendition = getThumbnailRendition(picture);
    const imageUrl = rendition && rendition.href;
    const caption = rendition && getCaption(picture);

    return (<div key={item._id} className="col-sm-6 col-lg-4 d-flex mb-4">
        <div className="card card--home" onClick={() => openItem(item, cardId)}>
            <img className="card-img-top" src={imageUrl} alt={caption} />
            <CardBody item={item} displaySource={false} />
            <CardFooter
                wordCount={wordCount(item)}
                charCount={characterCount(item)}
                pictureAvailable={!!picture}
                source={item.source}
                versioncreated={item.versioncreated}
                listConfig={listConfig}
            />
        </div>
    </div>);
};

function LargePictureTextCard ({items, title, product, openItem, isActive, cardId, listConfig}) {
    return (
        <CardRow title={title} product={product} isActive={isActive}>
            {items.map((item) => getPictureTextPanel(item, getPicture(item), openItem, cardId, listConfig))}
        </CardRow>
    );
}

LargePictureTextCard.propTypes = {
    items: PropTypes.array,
    title: PropTypes.string,
    product: PropTypes.object,
    openItem: PropTypes.func,
    isActive: PropTypes.bool,
    cardId: PropTypes.string,
    listConfig: PropTypes.object,
};

export default LargePictureTextCard;
