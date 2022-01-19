import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {isEmpty, cloneDeep, pickBy, assign} from 'lodash';
import {gettext, toggleValue} from 'utils';
import {getActiveDate} from 'local-store';

import NavCreatedPicker from './NavCreatedPicker';
import FilterGroup from './FilterGroup';
import FilterButton from './FilterButton';

import {
    resetFilter,
    updateFilterStateAndURL,
} from 'search/actions';
import {
    searchFilterSelector,
    searchCreatedSelector,
} from 'search/selectors';

import {
    selectDate
} from '../../../agenda/actions';

import {resultsFilteredSelector} from 'search/selectors';

class FiltersTab extends React.Component {
    constructor(props) {
        super(props);

        this.toggleGroup = this.toggleGroup.bind(this);
        this.getFilterGroups = this.getFilterGroups.bind(this);
        this.updateFilter = this.updateFilter.bind(this);
        this.setCreatedFilterAndSearch = this.setCreatedFilterAndSearch.bind(this);
        this.search = this.search.bind(this);
        this.reset = this.reset.bind(this);
        this.state = {
            groups: this.props.groups,
            activeFilter: cloneDeep(this.props.activeFilter),
            createdFilter: cloneDeep(this.props.createdFilter),
        };
    }

    toggleGroup(event, group) {
        event.preventDefault();
        this.setState({groups: this.props.groups.map((_group) =>
            _group === group ? Object.assign({}, _group, {isOpen: !_group.isOpen}) : _group
        )});
    }

    updateFilter(field, key, single) {
        // The `value` can be an Array
        let values = Array.isArray(key) ? key : [key];
        const currentFilters = cloneDeep(this.state.activeFilter);

        for (let _value of values) {
            currentFilters[field] = toggleValue(currentFilters[field], _value);

            if (!_value || !currentFilters[field] || currentFilters[field].length === 0) {
                delete currentFilters[field];
            } else if (single) {
                currentFilters[field] = currentFilters[field].filter(
                    (val) => val === _value
                );
            }
        }

        this.setState({activeFilter: currentFilters});
    }

    setCreatedFilterAndSearch(createdFilter) {
        const created = pickBy(
            assign(
                cloneDeep(this.state.createdFilter),
                createdFilter
            )
        );

        this.setState({createdFilter: created});
    }

    getFilterGroups() {
        return this.state.groups.map((group) => <FilterGroup
            key={group.label}
            group={group}
            activeFilter={this.state.activeFilter}
            aggregations={this.props.aggregations}
            toggleGroup={this.toggleGroup}
            toggleFilter={this.updateFilter}
        />);
    }

    search(event) {
        event.preventDefault();
        this.props.updateFilterStateAndURL(this.state.activeFilter, this.state.createdFilter);
        this.props.fetchItems();
    }

    reset(event) {
        event.preventDefault();
        this.setState({activeFilter: {}, createdFilter: {}});
        this.props.resetFilter();
        this.props.fetchItems();
        if ('function' === typeof this.props.selectDate) {
            this.props.selectDate(getActiveDate() || Date.now().valueOf(), 'day');
        }
    }

    render() {
        const {activeFilter, createdFilter} = this.state;
        const isResetActive = Object.keys(activeFilter).find((key) => !isEmpty(activeFilter[key]))
            || Object.keys(createdFilter).find((key) => !isEmpty(createdFilter[key]));

        return (
            <div className="m-3">
                {this.getFilterGroups().filter((group) => !!group).concat([
                    (<NavCreatedPicker
                        key="created"
                        createdFilter={createdFilter}
                        setCreatedFilter={this.setCreatedFilterAndSearch}
                    />),
                    !isResetActive && !this.props.resultsFiltered ? null : ([
                        <div key="reset-buffer" id="reset-filter-buffer" />,
                        <FilterButton
                            key='search'
                            label={gettext('Search')}
                            onClick={this.search}
                            className='search filter-button--border'
                            primary={true}
                        />,
                        <FilterButton
                            key='reset'
                            label={gettext('Clear filters')}
                            onClick={this.reset}
                            className='reset'
                            primary={false}
                        />,
                    ]),
                ])}
            </div>
        );
    }
}

FiltersTab.propTypes = {
    aggregations: PropTypes.object,
    activeFilter: PropTypes.object,
    createdFilter: PropTypes.object.isRequired,
    resultsFiltered: PropTypes.bool.isRequired,

    resetFilter: PropTypes.func.isRequired,
    updateFilterStateAndURL: PropTypes.func.isRequired,
    fetchItems: PropTypes.func.isRequired,
    groups: PropTypes.array,
    selectDate: PropTypes.func,
};

const mapStateToProps = (state) => ({
    aggregations: state.aggregations,
    activeFilter: searchFilterSelector(state),
    createdFilter: searchCreatedSelector(state),
    resultsFiltered: resultsFilteredSelector(state),
});

const mapDispatchToProps = {
    resetFilter,
    updateFilterStateAndURL,
    selectDate,
};

export default connect(mapStateToProps, mapDispatchToProps)(FiltersTab);
