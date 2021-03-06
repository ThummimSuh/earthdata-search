import actions from './index'
import {
  CLEAR_COLLECTION_GRANULES,
  UPDATE_FOCUSED_COLLECTION
} from '../constants/actionTypes'

import { createFocusedCollectionMetadata } from '../util/focusedCollection'
import { eventEmitter } from '../events/events'
import { getApplicationConfig } from '../../../../sharedUtils/config'
import { hasTag } from '../../../../sharedUtils/tags'
import { portalPathFromState } from '../../../../sharedUtils/portalPath'
import { updateAuthTokenFromHeaders } from './authToken'
import { updateCollectionMetadata } from './collections'
import { updateGranuleQuery } from './search'

import GraphQlRequest from '../util/request/graphQlRequest'

export const updateFocusedCollection = payload => ({
  type: UPDATE_FOCUSED_COLLECTION,
  payload
})

export const clearCollectionGranules = () => ({
  type: CLEAR_COLLECTION_GRANULES
})

/**
 * Perform a collection request based on the focusedCollection from the store.
 */
export const getFocusedCollection = () => async (dispatch, getState) => {
  const {
    authToken,
    focusedCollection,
    metadata,
    project = {},
    query,
    router
  } = getState()

  const { location } = router
  const { search } = location

  const { byId: projectById = {} } = project
  const { [focusedCollection]: focusedProjectCollection = {} } = projectById
  const { addedGranuleIds = [] } = focusedProjectCollection

  const { collections: collectionResults = {} } = metadata

  const { byId: searchResultsById = {} } = collectionResults
  const { [focusedCollection]: focusedCollectionMetadata } = searchResultsById
  const { isCwic = false } = focusedCollectionMetadata || {}

  const { collection: collectionQuery } = query
  const { spatial = {} } = collectionQuery
  const { polygon } = spatial
  if (isCwic && polygon) {
    dispatch(actions.toggleSpatialPolygonWarning(true))
  } else {
    dispatch(actions.toggleSpatialPolygonWarning(false))
  }

  // Reset granule pageNum to 1 when focusedCollection is changing
  dispatch(updateGranuleQuery({ pageNum: 1 }))

  if (focusedCollection === '') {
    dispatch(updateCollectionMetadata([]))
    return null
  }

  dispatch(actions.collectionRelevancyMetrics())

  const { collections } = metadata
  const { byId: fetchedCollections = {} } = collections
  const { [focusedCollection]: fetchedCollection } = fetchedCollections
  const { granules = {}, metadata: fetchedCollectionMetadata = {} } = fetchedCollection || {}
  const { allIds: allGranuleIds = [] } = granules

  // If we already have the metadata for this focusedCollection, don't fetch it again
  if (Object.keys(fetchedCollectionMetadata).length) {
    // Only request granules if there are none in the store for the collection or if the number
    // of granules in the store is the same as the number granules the user has manually added
    if (
      (addedGranuleIds.length > 0 && addedGranuleIds.length === allGranuleIds.length)
      || allGranuleIds.length === 0) {
      dispatch(actions.getGranules())
    }

    return null
  }

  const { defaultCmrSearchTags } = getApplicationConfig()

  const graphRequestObject = new GraphQlRequest(authToken)

  const graphQuery = `
    query GetCollection(
      $id: String!
      $includeHasGranules: Boolean
      $includeTags: String
    ) {
      collection(
        conceptId: $id
        includeHasGranules: $includeHasGranules
        includeTags: $includeTags
      ) {
        archiveAndDistributionInformation
        boxes
        conceptId
        dataCenter
        dataCenters
        doi
        hasGranules
        relatedUrls
        scienceKeywords
        shortName
        spatialExtent
        summary
        tags
        temporalExtents
        title
        versionId
        services {
          count
          items {
            conceptId
            type
            supportedOutputFormats
            supportedReformattings
          }
        }
        variables {
          count
          items {
            conceptId
            definition
            longName
            name
            scienceKeywords
          }
        }
      }
    }`

  const response = graphRequestObject.search(graphQuery, {
    id: focusedCollection,
    includeHasGranules: true,
    includeTags: defaultCmrSearchTags.join(',')
  })
    .then((response) => {
      const payload = []

      const {
        data: responseData,
        headers
      } = response
      const { data } = responseData
      const { collection } = data

      if (collection) {
        const {
          archiveAndDistributionInformation,
          boxes,
          conceptId,
          dataCenter,
          hasGranules,
          services,
          shortName,
          summary,
          tags,
          title,
          variables,
          versionId
        } = collection

        const focusedMetadata = createFocusedCollectionMetadata(collection, authToken)

        payload.push({
          [focusedCollection]: {
            metadata: {
              archiveAndDistributionInformation,
              boxes,
              conceptId,
              dataCenter,
              hasGranules,
              services,
              shortName,
              summary,
              tags,
              title,
              variables,
              versionId,
              ...focusedMetadata
            },
            isCwic: hasGranules === false && hasTag({ tags }, 'org.ceos.wgiss.cwic.granules.prod', '')
          }
        })

        // A users authToken will come back with an authenticated request if a valid token was used
        dispatch(updateAuthTokenFromHeaders(headers))

        // Update metadata in the store
        dispatch(updateCollectionMetadata(payload))

        dispatch(actions.getGranules())
      } else {
        // If no data was returned, clear the focused collection and redirect the user back to the search page
        dispatch(actions.updateFocusedCollection(''))

        dispatch(actions.changeUrl({
          pathname: `${portalPathFromState(getState())}/search`,
          search
        }))
      }
    })
    .catch((error) => {
      dispatch(actions.handleError({
        error,
        action: 'getFocusedCollection',
        resource: 'collection'
      }))
    })

  return response
}

/**
 * Change the focusedCollection, and get the focusedCollection metadata.
 * @param {String} collectionId
 */
export const changeFocusedCollection = collectionId => (dispatch, getState) => {
  const { focusedCollection: currentFocusedCollection } = getState()
  if (collectionId === '') {
    dispatch(actions.changeFocusedGranule(''))
    eventEmitter.emit(`map.layer.${currentFocusedCollection}.stickygranule`, { granule: null })

    const { router } = getState()
    const { location } = router
    const { search } = location

    dispatch(actions.changeUrl({
      pathname: `${portalPathFromState(getState())}/search`,
      search
    }))
  }

  dispatch(updateFocusedCollection(collectionId))
  dispatch(actions.getTimeline())
  dispatch(actions.getFocusedCollection())
}

export const viewCollectionGranules = collectionId => (dispatch, getState) => {
  dispatch(changeFocusedCollection(collectionId))

  const { router } = getState()
  const { location } = router
  const { search } = location

  dispatch(actions.changeUrl({
    pathname: `${portalPathFromState(getState())}/search/granules`,
    search
  }))
}

export const viewCollectionDetails = collectionId => (dispatch, getState) => {
  dispatch(changeFocusedCollection(collectionId))

  const { router } = getState()
  const { location } = router
  const { search } = location

  dispatch(actions.changeUrl({
    pathname: `${portalPathFromState(getState())}/search/granules/collection-details`,
    search
  }))
}
