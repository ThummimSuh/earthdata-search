import configureMockStore from 'redux-mock-store'
import thunk from 'redux-thunk'
import nock from 'nock'

import { fetchAccessMethods } from '../accessMethods'
import { ADD_ACCESS_METHODS, ADD_ERROR } from '../../constants/actionTypes'

const mockStore = configureMockStore([thunk])

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fetchAccessMethods', () => {
  test('does not fetch access methods if the user is not logged in', () => {
    const store = mockStore({
      authToken: ''
    })

    // call the dispatch
    expect(store.dispatch(fetchAccessMethods(['collectionId']))).toEqual(
      new Promise(resolve => resolve(null))
    )
  })

  test('does not fetch access methods if no collections were provided', () => {
    const store = mockStore({
      authToken: ''
    })

    // call the dispatch
    expect(store.dispatch(fetchAccessMethods())).toEqual(
      new Promise(resolve => resolve(null))
    )
  })

  test('calls the error logger when providers action fails', async () => {
    const collectionId = 'collectionId'

    nock(/localhost/)
      .get(/providers/)
      .reply(500, {
        errors: ['HTTP Request Error']
      },
      {
        'jwt-token': 'token'
      })

    nock(/localhost/)
      .post(/error_logger/)
      .reply(200)

    const store = mockStore({
      authToken: '123',
      metadata: {
        collections: {
          allIds: [collectionId],
          byId: {
            collectionId: {
              granules: {
                hits: 100
              },
              metadata: {
                tags: {
                  'edsc.extra.serverless.collection_capabilities': {
                    data: {
                      granule_online_access_flag: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      project: {
        collectionIds: [collectionId]
      },
      providers: []
    })

    // call the dispatch
    await store.dispatch(fetchAccessMethods([collectionId]))

    const storeActions = store.getActions()
    expect(storeActions[0]).toEqual({
      type: ADD_ERROR,
      payload: expect.objectContaining({
        title: 'Error retrieving providers',
        message: 'There was a problem completing the request'
      })
    })
  })

  test('calls the error logger when the collections request fails', async () => {
    const collectionId = 'collectionId'

    nock(/localhost/)
      .post(/access_methods/)
      .reply(500, {
        errors: ['HTTP Request Error']
      },
      {
        'jwt-token': 'token'
      })

    nock(/localhost/)
      .post(/error_logger/)
      .reply(200)

    const store = mockStore({
      authToken: '123',
      metadata: {
        collections: {
          allIds: [collectionId],
          byId: {
            collectionId: {
              granules: {
                hits: 5000
              },
              metadata: {
                tags: {
                  'edsc.extra.serverless.subset_service.echo_orders': {
                    data: {
                      option_definitions: [
                        {
                          id: 'option_definition_guid',
                          name: 'Delivery Option'
                        }
                      ]
                    }
                  },
                  'edsc.extra.serverless.collection_capabilities': {
                    data: {
                      granule_online_access_flag: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      project: {
        byId: {
          [collectionId]: {}
        },
        collectionIds: [collectionId]
      },
      providers: [
        {
          provider: {
            id: 'abcd-1234-efgh-5678',
            organization_name: 'EDSC-TEST',
            provider_id: 'EDSC-TEST'
          }
        }, {
          provider: {
            id: 'abcd-1234-efgh-5678',
            organization_name: 'NON-EDSC-TEST',
            provider_id: 'NON-EDSC-TEST'
          }
        }
      ]
    })

    // call the dispatch
    await store.dispatch(fetchAccessMethods([collectionId]))

    const storeActions = store.getActions()
    expect(storeActions[0]).toEqual({
      type: ADD_ERROR,
      payload: expect.objectContaining({
        title: 'Error retrieving access methods',
        message: 'There was a problem completing the request'
      })
    })
  })

  test('returns download method if it is the only access method', async () => {
    const collectionId = 'collectionId'

    const store = mockStore({
      authToken: '123',
      metadata: {
        collections: {
          allIds: [collectionId],
          byId: {
            collectionId: {
              granules: {
                hits: 100
              },
              metadata: {
                tags: {
                  'edsc.extra.serverless.collection_capabilities': {
                    data: {
                      granule_online_access_flag: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      project: {
        byId: {
          [collectionId]: {}
        },
        collectionIds: [collectionId]
      },
      providers: [
        {
          provider: {
            id: 'abcd-1234-efgh-5678',
            organization_name: 'EDSC-TEST',
            provider_id: 'EDSC-TEST'
          }
        }, {
          provider: {
            id: 'abcd-1234-efgh-5678',
            organization_name: 'NON-EDSC-TEST',
            provider_id: 'NON-EDSC-TEST'
          }
        }
      ]
    })

    // call the dispatch
    await store.dispatch(fetchAccessMethods([collectionId])).then(() => {
      const storeActions = store.getActions()
      expect(storeActions[0]).toEqual({
        type: ADD_ACCESS_METHODS,
        payload: {
          collectionId,
          methods: {
            download: {
              isValid: true,
              type: 'download'
            }
          },
          selectedAccessMethod: 'download'
        }
      })
    })
  })

  test('fetches access methods from api if needed', async () => {
    const download = {
      isValid: true,
      type: 'download'
    }
    const echoOrder0 = {
      id: 'service_id',
      type: 'ECHO ORDERS',
      url: 'mock url',
      option_definition: {
        id: 'option_definition_guid',
        name: 'Delivery Option'
      },
      form: 'mock form here'
    }

    nock(/localhost/)
      .post(/access_methods/)
      .reply(200, {
        accessMethods: {
          download,
          echoOrder0
        }
      })

    const collectionId = 'collectionId'
    const store = mockStore({
      authToken: '123',
      metadata: {
        collections: {
          allIds: [collectionId],
          byId: {
            collectionId: {
              granules: {
                hits: 100
              },
              metadata: {
                tags: {
                  'edsc.extra.serverless.subset_service.echo_orders': {
                    data: {
                      option_definitions: [
                        {
                          id: 'option_definition_guid',
                          name: 'Delivery Option'
                        }
                      ]
                    }
                  },
                  'edsc.extra.serverless.collection_capabilities': {
                    data: {
                      granule_online_access_flag: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      project: {
        byId: {
          [collectionId]: {}
        },
        collectionIds: [collectionId]
      },
      providers: [
        {
          provider: {
            id: 'abcd-1234-efgh-5678',
            organization_name: 'EDSC-TEST',
            provider_id: 'EDSC-TEST'
          }
        }, {
          provider: {
            id: 'abcd-1234-efgh-5678',
            organization_name: 'NON-EDSC-TEST',
            provider_id: 'NON-EDSC-TEST'
          }
        }
      ]
    })

    // call the dispatch
    await store.dispatch(fetchAccessMethods([collectionId])).then(() => {
      const storeActions = store.getActions()
      expect(storeActions[0]).toEqual({
        type: ADD_ACCESS_METHODS,
        payload: {
          collectionId,
          methods: {
            download,
            echoOrder0
          }
        }
      })
    })
  })

  describe('order chunking', () => {
    test('it chunks the order if more than 2000 granules exist', async () => {
      const echoOrder0 = {
        id: 'service_id',
        type: 'ECHO ORDERS',
        url: 'mock url',
        option_definition: {
          id: 'option_definition_guid',
          name: 'Delivery Option'
        },
        form: 'mock form here'
      }
      nock(/localhost/)
        .post(/access_methods/)
        .reply(200, {
          accessMethods: {
            echoOrder0
          },
          selectedAccessMethod: 'echoOrder0'
        })

      const collectionId = 'collectionId'
      const store = mockStore({
        authToken: '123',
        metadata: {
          collections: {
            allIds: [collectionId],
            byId: {
              collectionId: {
                granules: {
                  hits: 5000
                },
                metadata: {
                  tags: {
                    'edsc.extra.serverless.subset_service.echo_orders': {
                      data: {
                        option_definitions: [
                          {
                            id: 'option_definition_guid',
                            name: 'Delivery Option'
                          }
                        ]
                      }
                    },
                    'edsc.extra.serverless.collection_capabilities': {
                      data: {
                        granule_online_access_flag: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        project: {
          byId: {
            [collectionId]: {}
          },
          collectionIds: [collectionId]
        },
        providers: [
          {
            provider: {
              id: 'abcd-1234-efgh-5678',
              organization_name: 'EDSC-TEST',
              provider_id: 'EDSC-TEST'
            }
          }, {
            provider: {
              id: 'abcd-1234-efgh-5678',
              organization_name: 'NON-EDSC-TEST',
              provider_id: 'NON-EDSC-TEST'
            }
          }
        ]
      })

      // call the dispatch
      await store.dispatch(fetchAccessMethods([collectionId])).then(() => {
        const storeActions = store.getActions()
        expect(storeActions[0]).toEqual({
          type: ADD_ACCESS_METHODS,
          payload: {
            collectionId,
            methods: {
              echoOrder0
            },
            orderCount: 3,
            selectedAccessMethod: 'echoOrder0'
          }
        })
      })
    })

    test('it does not chunk the order if less than 2000 granules exist', async () => {
      const echoOrder0 = {
        id: 'service_id',
        type: 'ECHO ORDERS',
        url: 'mock url',
        option_definition: {
          id: 'option_definition_guid',
          name: 'Delivery Option'
        },
        form: 'mock form here'
      }
      nock(/localhost/)
        .post(/access_methods/)
        .reply(200, {
          accessMethods: {
            echoOrder0
          },
          selectedAccessMethod: 'echoOrder0'
        })

      const collectionId = 'collectionId'
      const store = mockStore({
        authToken: '123',
        metadata: {
          collections: {
            allIds: [collectionId],
            byId: {
              collectionId: {
                granules: {
                  hits: 25
                },
                metadata: {
                  tags: {
                    'edsc.extra.serverless.subset_service.echo_orders': {
                      data: {
                        option_definitions: [
                          {
                            id: 'option_definition_guid',
                            name: 'Delivery Option'
                          }
                        ]
                      }
                    },
                    'edsc.extra.serverless.collection_capabilities': {
                      data: {
                        granule_online_access_flag: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        project: {
          byId: {
            [collectionId]: {}
          },
          collectionIds: [collectionId]
        },
        providers: [
          {
            provider: {
              id: 'abcd-1234-efgh-5678',
              organization_name: 'EDSC-TEST',
              provider_id: 'EDSC-TEST'
            }
          }, {
            provider: {
              id: 'abcd-1234-efgh-5678',
              organization_name: 'NON-EDSC-TEST',
              provider_id: 'NON-EDSC-TEST'
            }
          }
        ]
      })

      // call the dispatch
      await store.dispatch(fetchAccessMethods([collectionId])).then(() => {
        const storeActions = store.getActions()
        expect(storeActions[0]).toEqual({
          type: ADD_ACCESS_METHODS,
          payload: {
            collectionId,
            methods: {
              echoOrder0
            },
            orderCount: 1,
            selectedAccessMethod: 'echoOrder0'
          }
        })
      })
    })

    test('ignores chuncking and uses added granule count when individual granules are added', async () => {
      const echoOrder0 = {
        id: 'service_id',
        type: 'ECHO ORDERS',
        url: 'mock url',
        option_definition: {
          id: 'option_definition_guid',
          name: 'Delivery Option'
        },
        form: 'mock form here'
      }
      nock(/localhost/)
        .post(/access_methods/)
        .reply(200, {
          accessMethods: {
            echoOrder0
          },
          selectedAccessMethod: 'echoOrder0'
        })

      const collectionId = 'collectionId'
      const store = mockStore({
        authToken: '123',
        metadata: {
          collections: {
            allIds: [collectionId],
            byId: {
              collectionId: {
                granules: {
                  hits: 5000
                },
                metadata: {
                  tags: {
                    'edsc.extra.serverless.subset_service.echo_orders': {
                      data: {
                        option_definitions: [
                          {
                            id: 'option_definition_guid',
                            name: 'Delivery Option'
                          }
                        ]
                      }
                    },
                    'edsc.extra.serverless.collection_capabilities': {
                      data: {
                        granule_online_access_flag: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        project: {
          byId: {
            [collectionId]: {
              addedGranuleIds: ['GRAN-1', 'GRAN-2']
            }
          },
          collectionIds: [collectionId]
        },
        providers: [
          {
            provider: {
              id: 'abcd-1234-efgh-5678',
              organization_name: 'EDSC-TEST',
              provider_id: 'EDSC-TEST'
            }
          }, {
            provider: {
              id: 'abcd-1234-efgh-5678',
              organization_name: 'NON-EDSC-TEST',
              provider_id: 'NON-EDSC-TEST'
            }
          }
        ]
      })

      // call the dispatch
      await store.dispatch(fetchAccessMethods([collectionId])).then(() => {
        const storeActions = store.getActions()
        expect(storeActions[0]).toEqual({
          type: ADD_ACCESS_METHODS,
          payload: {
            collectionId,
            methods: {
              echoOrder0
            },
            orderCount: 1,
            selectedAccessMethod: 'echoOrder0'
          }
        })
      })
    })
  })
})
