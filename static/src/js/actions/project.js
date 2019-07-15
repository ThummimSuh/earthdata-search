import actions from './index'
import {
  ADD_COLLECTION_TO_PROJECT,
  REMOVE_COLLECTION_FROM_PROJECT,
  RESTORE_PROJECT,
  SELECT_ACCESS_METHOD,
  TOGGLE_COLLECTION_VISIBILITY,
  UPDATE_ACCESS_METHOD,
  UPDATE_PROJECT_GRANULES,
  ADD_ACCESS_METHODS
} from '../constants/actionTypes'
import GranuleRequest from '../util/request/granuleRequest'
import CwicGranuleRequest from '../util/request/cwic'
import { updateAuthTokenFromHeaders } from './authToken'
import { updateCollectionMetadata } from './collections'
import { prepareGranuleParams, populateGranuleResults, buildGranuleSearchParams } from '../util/granules'
import { convertSize } from '../util/project'
import { createFocusedCollectionMetadata, getCollectionMetadata } from '../util/focusedCollection'
import { prepareCollectionParams, buildCollectionSearchParams } from '../util/collections'
import isProjectCollectionValid from '../util/isProjectCollectionValid'

export const addCollectionToProject = payload => ({
  type: ADD_COLLECTION_TO_PROJECT,
  payload
})

export const removeCollectionFromProject = payload => ({
  type: REMOVE_COLLECTION_FROM_PROJECT,
  payload
})

export const updateProjectGranules = payload => ({
  type: UPDATE_PROJECT_GRANULES,
  payload
})

export const toggleCollectionVisibility = payload => ({
  type: TOGGLE_COLLECTION_VISIBILITY,
  payload
})

export const restoreProject = payload => ({
  type: RESTORE_PROJECT,
  payload
})

export const addAccessMethods = payload => ({
  type: ADD_ACCESS_METHODS,
  payload
})

export const updateAccessMethod = payload => ({
  type: UPDATE_ACCESS_METHOD,
  payload: {
    ...payload,
    isValid: isProjectCollectionValid(payload.method)
  }
})

export const selectAccessMethod = payload => ({
  type: SELECT_ACCESS_METHOD,
  payload
})

export const getProjectGranules = () => (dispatch, getState) => {
  const { project } = getState()
  const { collectionIds: projectIds } = project

  return Promise.all(projectIds.map((collectionId) => {
    const granuleParams = prepareGranuleParams(getState(), collectionId)

    if (!granuleParams) {
      return null
    }

    const {
      authToken,
      isCwicCollection
    } = granuleParams

    let requestObject = null
    if (isCwicCollection) {
      requestObject = new CwicGranuleRequest()
    } else {
      requestObject = new GranuleRequest(authToken)
    }

    const searchResponse = requestObject.search(buildGranuleSearchParams(granuleParams))
      .then((response) => {
        const payload = populateGranuleResults(collectionId, isCwicCollection, response)
        let size = 0
        payload.results.forEach((granule) => {
          size += parseFloat(granule.granule_size || 0)
        })

        const totalSize = size / payload.results.length * payload.hits

        payload.totalSize = convertSize(totalSize)

        dispatch(updateAuthTokenFromHeaders(response.headers))
        dispatch(updateProjectGranules(payload))
      })
      .catch((e) => {
        if (e.response) {
          const { data } = e.response
          const { errors = [] } = data

          console.log(errors)
        } else {
          console.log(e)
        }
      })

    return searchResponse
  }))
}

export const getProjectCollections = () => (dispatch, getState) => {
  const collectionParams = prepareCollectionParams(getState())

  const { project } = getState()
  const { collectionIds: projectIds } = project

  if (projectIds.length === 0) {
    return null
  }

  const { authToken } = getState()

  const searchParams = buildCollectionSearchParams(collectionParams)
  const response = getCollectionMetadata({
    ...searchParams,
    conceptId: projectIds,
    featureFacets: {},
    includeFacets: undefined,
    tagKey: undefined,
    includeTags: 'edsc.*,org.ceos.wgiss.cwic.granules.prod'
  }, authToken)
    .then(([collectionJson, collectionUmm]) => {
      const payload = []
      const { entry: responseJson } = collectionJson.data.feed
      const { items: responseUmm } = collectionUmm.data

      responseJson.forEach((collection) => {
        const { id } = collection
        const metadata = collection
        const ummIndex = responseUmm.findIndex(item => id === item.meta['concept-id'])
        const ummMetadata = responseUmm[ummIndex].umm

        const formattedMetadata = createFocusedCollectionMetadata(metadata, ummMetadata, authToken)

        payload.push({
          [id]: {
            metadata,
            ummMetadata,
            formattedMetadata
          }
        })
      })

      dispatch(updateAuthTokenFromHeaders(collectionJson.headers))
      dispatch(updateCollectionMetadata(payload))
      dispatch(actions.getProjectGranules())
      dispatch(actions.fetchAccessMethods())
    }, (error) => {
      throw new Error('Request failed', error)
    })
    .catch((e) => {
      console.log('Promise Rejected', e)
    })

  return response
}

export const addProjectCollection = collectionId => (dispatch) => {
  dispatch(addCollectionToProject(collectionId))
  dispatch(actions.getProjectCollections())
}