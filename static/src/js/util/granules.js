import { getFocusedCollectionMetadata } from './focusedCollection'
import { encodeTemporal } from './url/temporalEncoders'
import { encodeGridCoords } from './url/gridEncoders'

/**
 * Populate granule payload used to update the store
 * @param {string} collectionId
 * @param {boolean} isCwic
 * @param {object} response
 * @returns Granule payload
 */
export const populateGranuleResults = (collectionId, isCwic, response) => {
  const payload = {}

  payload.collectionId = collectionId
  payload.results = response.data.feed.entry
  payload.isCwic = isCwic

  if (isCwic) {
    payload.hits = response.data.feed.hits
  } else {
    payload.hits = parseInt(response.headers['cmr-hits'], 10)
  }

  return payload
}

/**
 * Prepare parameters used in getGranules() based on current Redux State, or provided project collection
 * @param {object} state Current Redux State
 * @param {string} projectCollectionId Optional: CollectionId of a Project collection
 * @returns Parameters used in Granules request
 */
export const prepareGranuleParams = (state, projectCollectionId) => {
  const {
    authToken,
    metadata = {},
    focusedCollection: focusedCollectionId,
    query = {}
  } = state
  const { collections } = metadata

  const collectionId = projectCollectionId || focusedCollectionId

  // If we don't have a focusedCollection or projectCollectionId, bail out!
  if (!collectionId) {
    return null
  }

  const focusedCollectionMetadata = getFocusedCollectionMetadata(collectionId, collections)
  if (Object.keys(focusedCollectionMetadata).length === 0) return null

  const {
    collection: collectionQuery,
    granule: granuleQuery
  } = query

  const {
    spatial = {},
    overrideTemporal = {},
    temporal = {},
    gridName = ''
  } = collectionQuery

  const {
    gridCoords = '',
    pageNum
  } = granuleQuery

  const {
    boundingBox,
    point,
    polygon
  } = spatial

  const { metadata: collectionMetadata = {} } = focusedCollectionMetadata[collectionId]
  const { tags = {} } = collectionMetadata

  // If we have an overrideTemporal use it, if not use temporal
  let temporalString
  const {
    endDate: overrideEnd,
    startDate: overrideStart
  } = overrideTemporal
  if (overrideEnd && overrideStart) {
    temporalString = encodeTemporal(overrideTemporal)
  } else {
    temporalString = encodeTemporal(temporal)
  }

  const isCwicCollection = Object.keys(tags).includes('org.ceos.wgiss.cwic.granules.prod')
    && !collectionMetadata.has_granules

  return {
    authToken,
    boundingBox,
    collectionId,
    gridName,
    gridCoords: encodeGridCoords(gridCoords),
    isCwicCollection,
    pageNum,
    point,
    polygon,
    temporalString
  }
}

/**
 * Translates the values returned from prepareGranuleParams to the camelCased keys that are expected in
 * the granules.search() function
 * @param {object} params - Params to be passed to the granules.search() function.
 * @returns Parameters to be provided to the Granules request with camel cased keys
 */
export const buildGranuleSearchParams = (params) => {
  const {
    boundingBox,
    collectionId,
    gridName,
    gridCoords,
    pageNum,
    point,
    polygon,
    temporalString
  } = params

  let twoDCoordinateSystem = ''

  if (gridName) {
    twoDCoordinateSystem = {}
    twoDCoordinateSystem.name = gridName

    if (gridCoords) twoDCoordinateSystem.coordinates = gridCoords
  }

  return {
    boundingBox,
    echoCollectionId: collectionId,
    pageNum,
    pageSize: 20,
    point,
    polygon,
    sortKey: '-start_date',
    temporal: temporalString,
    twoDCoordinateSystem
  }
}

/**
 * Create the ECHO10 Metadata URLs using the granule concept ID
 * @param {string} granuleId - The granule ID
 * @returns {object} - An object containing the various URLs
 */
export const createEcho10MetadataUrls = (granuleId) => {
  // TODO: This should eventually support authentication by appending the token information
  const metadataUrlTypes = [
    { ext: 'atom', title: 'ATOM' },
    { ext: 'echo10', title: 'ECHO 10' },
    { ext: 'iso19115', title: 'ISO 19115' },
    { ext: 'native', title: 'Native' },
    { ext: 'umm_json', title: 'UMM-G' }
  ]
  const metadataUrls = {}

  // Set a key for each URL type and append the display title and href. 'native' does not
  // use an extension on the href so we omit it.
  metadataUrlTypes.forEach((type) => {
    metadataUrls[type.ext] = {
      title: type.title,
      href: `https://cmr.earthdata.nasa.gov/search/concepts/${granuleId}${type.ext !== 'native' ? `.${type.ext}` : ''}`
    }
  })

  return metadataUrls
}

/**
 * Determines if a given link is a data link.
 * A link is a data link if it has data in the rel property and it is not inherited.
 * @param {object} link An individual link object from granule metadata
 * @param {string} type 'http' or 'ftp'
 * @returns {boolean}
 */
export const isDataLink = (link, type) => {
  const {
    href,
    inherited = false,
    rel
  } = link

  return href.indexOf(type) !== -1
    && rel.indexOf('/data#') !== -1
    && inherited !== true
}

/**
 * Given a list of granule metadata links, filters out those links that are not data links
 * prefering http over ftp for duplicate filenames
 * @param {array} links List of links from granule metadata
 * @returns {array} List of data links filters from input links
 */
export const createDataLinks = (links = []) => {
  // All 'http' data links
  const httpDataLinks = links.filter(link => isDataLink(link, 'http'))

  // Strip filenames from httpDataLinks
  const filenames = httpDataLinks.map(link => link.href.substr(link.href.lastIndexOf('/') + 1).replace('.html', ''))

  // Find any 'ftp' data links that have filenames not already included with 'http' links
  const ftpLinks = links.filter((link) => {
    const { href } = link

    const filename = href.substr(href.lastIndexOf('/') + 1)

    return isDataLink(link, 'ftp') && filenames.indexOf(filename) === -1
  })

  // Return http and ftp data links with a unique list of filenames, prefering http
  return [
    ...httpDataLinks,
    ...ftpLinks
  ]
}

/**
* Pull out download links from within the granule metadata
* @param {Array} granules search result for granules that a user has asked to download
* @returns {Array} All relevant urls for downloadable granules
*/
// eslint-disable-next-line arrow-body-style
export const getDownloadUrls = (granules) => {
  // Iterate through each granule search result to pull out relevant links
  return granules.map((granuleMetadata) => {
    const { links: linkMetadata = [] } = granuleMetadata

    // Find the correct link from the list within the metadata
    return linkMetadata.find((link) => {
      const { inherited, rel } = link
      return rel.includes('/data#') && !inherited
    })
  }).filter(Boolean)
}