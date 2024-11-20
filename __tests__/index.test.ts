// index.test.ts

import { run } from '../src/main.js'

// Mock the main module
jest.mock('../src/main', () => ({
  run: jest.fn(),
}))

describe('Action Entrypoint', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  it('should call the run function when executed', async () => {
    // Import the index file to trigger the run function
    await import('../src/index')

    // Check if the run function was called
    expect(run).toHaveBeenCalledTimes(1)
  })
})
