import { setFailed } from '@actions/core'
import { Arguments } from './args.ts'
import { GitService } from './git.ts'
import { GithubService } from './github.ts'

const REPOSITORY_NAME = 'jmeter-plugins'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const args: Arguments = new Arguments()
    const gitHandler: GitService = new GitService(args)

    await gitHandler.init(REPOSITORY_NAME)
    const githubService: GithubService = await GithubService.getInstance(
      args.githubToken
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) setFailed(error.message)
  }
}
