import { useEffect, useLayoutEffect } from 'react'
import { configObject } from './config'
import { StoreInternalAPI } from './createStore'
import { error } from './error'
import { Store, Abstract } from './types'

// For SSR / React Native: https://github.com/react-spring/zustand/pull/34
export const useIsoLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

export const isStore = (store: Abstract<any>): store is Store<any, any> =>
  storeMap.has(store)

// Following answer is used as a starting point
// https://stackoverflow.com/questions/4459928/how-to-deep-clone-in-javascript/40294058#40294058
// answered Oct 27 '16 at 20:56 by trincot
export const deepClone = (
  state: any,
  store: StoreInternalAPI<any>,
  relativeAddress: string[] = []
): any => {
  const childStores = new Set()
  const deepCloneInner = (
    obj: any,
    hash = new WeakMap(),
    address: string[] = relativeAddress
  ): any => {
    if (Object(obj) !== obj) {
      const primitive = { [configObject.valueSymbol]: obj } as Abstract<any>
      // record the address  and store of the primitive. (for being able to subscribe and set)
      memberMap.set(primitive, { internal: store, address })
      return [primitive, obj]
    }
    if (hash.has(obj)) return [...hash.get(obj)] // cyclic reference
    const attemptChildStore = storeMap.get(obj)

    if (attemptChildStore) {
      childStores.add(attemptChildStore)
      const mc = attemptChildStore.internal.getMutableCopy()
      parentMap.set(mc, { parent: store.getMutableCopy(), address })
      return [mc, attemptChildStore.internal.getNormalizedState()]
    }
    const isArray = Array.isArray(obj)
    const isFunction = typeof obj === 'function'

    const result = isArray
      ? []
      : isFunction
      ? obj
      : obj.constructor
      ? new obj.constructor()
      : Object.create(null)

    const result2 = isArray
      ? []
      : isFunction
      ? obj
      : obj.constructor
      ? new obj.constructor()
      : Object.create(null)

    // record the address and store of the object. (for being able to subscribe and set)
    memberMap.set(result, { internal: store, address })
    hash.set(obj, [result, result2])

    Object.keys(obj).map((key) => {
      address = []
      address.push(key)
      const cloneResult = deepCloneInner(obj[key], hash, address)
      result[key] = cloneResult[0]
      result2[key] = cloneResult[1]
      // reset the hash, because we want to consider only the children as circular deps.
      hash = new WeakMap()
    })

    return [result, result2]
  }

  if (isStore(state)) {
    // IMPORTANT: following parts could be able to be changed based on the config
    const child = storeMap.get(state)
    childStores.add(child)
    // @ts-ignore
    const [result, result2] = [state, child.internal.getNormalizedState()]
    return [result, result2, childStores]
  } else {
    const [result, result2] = deepCloneInner(state)
    return [result, result2, childStores]
  }
}

export const destroy = <T extends Abstract<any>>(item: T) => {
  const record = storeMap.get(item)
  if (record) return record.internal.destroy()
  else throw error('destroy')
}

export const setValueByAddress = (
  root: object,
  address: string[],
  newValue: any
) => {
  if (address.length) {
    address.reduce((acc: any, key: string, i) => {
      if (i === address.length - 1) acc[key] = newValue
      return acc[key]
    }, root)
  } else {
    throw error('internal-1')
  }
}

export const getValueByAddress = (root: object, address: string[]) => {
  if (address.length) {
    return address.reduce((acc: any, key: string, i) => {
      return acc[key]
    }, root)
  } else {
    return root
  }
}

// This map is used by {get, subscribe} exports, to know the store that
// the member (object or primitive) belongs to, and its address in that store
interface InternalRecord {
  internal: StoreInternalAPI<any>
  address: string[]
}

export const memberMap = new WeakMap<Abstract<any>, InternalRecord>()
export const storeMap = new WeakMap<Abstract<any>, InternalRecord>()
export const parentMap = new WeakMap()