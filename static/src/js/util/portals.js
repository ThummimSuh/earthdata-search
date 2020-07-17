import { getApplicationConfig } from '../../../../sharedUtils/config'

/**
 * Does the given portalId match the application defaultPortal
 * @param {String} portalId
 */
export const isDefaultPortal = (portalId) => {
  const defaultPortalId = getApplicationConfig().defaultPortal
  return portalId === defaultPortalId
}

/**
 * Returns the value of features.authentication from a portal config
 * @param {Object} portal Portal config
 */
export const authenticationEnabled = (portal) => {
  const { features = {} } = portal
  const { authentication } = features

  return authentication
}
