import Action from './Action'

describe('#Action', () => {
  test('Should throw if no action name string is present', () => {
    expect(() => new Action()).toThrowError()
  })
  
  test('Should launch with default parameters if none are declared', () => {
    const action : Action = new Action('some.test')
    
    expect(action).toBeInstanceOf(Action)

    expect(action.payload).toMatchObject({})
    expect(action.context).toMatchObject({})
  })
})