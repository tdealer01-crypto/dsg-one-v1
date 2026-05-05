import type { FileTree } from './file-tree';

export type GitHubWriteResult = {
  branch: string;
  commitSha: string;
  treeHash: string;
};

export async function writeTreeToGithubBranch(
  branch: string,
  tree: FileTree,
): Promise<GitHubWriteResult> {
  if (!branch) throw new Error('DSG_BRANCH_REQUIRED');
  if (!tree.treeHash || tree.files.length === 0) throw new Error('DSG_FILE_TREE_REQUIRED');

  throw new Error('DSG_GITHUB_WRITER_NOT_WIRED_REAL_GITHUB_API_REQUIRED');
}
