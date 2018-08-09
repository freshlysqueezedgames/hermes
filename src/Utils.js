
/**
 * We map strings longest first so that we can ensure that the closest matches fort.pathHeap is always found
 * @param {*} object 
 */
export const OrderByLongest = (object : Object) => {
  let keys : Array = Object.keys(object)
  const orderedObject : Object = Object.create(null)

  keys.sort((a : string, b : string) : number => {
    if (a.length > b.length) {
      return -1
    }

    if (b.length > a.length) {
      return 1
    }

    return 0
  })

  let i : number = -1
  const l : number = keys.length

  while (++i < l) {
    const key : string = keys[i]

    orderedObject[key] = object[key]
  }

  return orderedObject 
}