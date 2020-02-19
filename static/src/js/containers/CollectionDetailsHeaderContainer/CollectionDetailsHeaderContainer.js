import React from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import {
  withRouter
} from 'react-router-dom'

import { getFocusedCollectionMetadata } from '../../util/focusedCollection'

import CollectionDetailsHeader from '../../components/CollectionDetails/CollectionDetailsHeader'

const mapStateToProps = state => ({
  collections: state.metadata.collections,
  focusedCollection: state.focusedCollection,
  collectionSearch: state.query.collection,
  mapProjection: state.map.projection
})

export const CollectionDetailsHeaderContainer = ({
  collections,
  focusedCollection,
  collectionSearch = {},
  mapProjection
}) => {
  const focusedCollectionMetadata = getFocusedCollectionMetadata(focusedCollection, collections)

  return (
    <CollectionDetailsHeader
      focusedCollectionMetadata={focusedCollectionMetadata}
      collectionSearch={collectionSearch}
      mapProjection={mapProjection}
    />
  )
}

CollectionDetailsHeaderContainer.propTypes = {
  collections: PropTypes.shape({}).isRequired,
  focusedCollection: PropTypes.string.isRequired,
  collectionSearch: PropTypes.shape({}).isRequired,
  mapProjection: PropTypes.string.isRequired
}

export default withRouter(
  connect(mapStateToProps, null)(CollectionDetailsHeaderContainer)
)
