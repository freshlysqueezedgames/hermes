import Route from './Route'

describe('#Test', () => {
  test('should hold a regex expression covering a path with ambiguous ending', () => {
    const route : Route = new Route('test/test')

    expect(route.re.test('test/test/test')).toEqual(true)
  })
})