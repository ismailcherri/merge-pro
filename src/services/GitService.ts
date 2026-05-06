import * as vscode from 'vscode';
import type { MergeChange } from '../types';

// Type stubs for the vscode.git extension API (not exported publicly)
interface GitExtensionAPI {
  getAPI(version: 1): GitAPI;
}
interface GitAPI {
  repositories: Repository[];
  onDidOpenRepository: vscode.Event<Repository>;
}
interface Repository {
  rootUri: vscode.Uri;
  state: RepositoryState;
}
interface RepositoryState {
  mergeChanges: Change[];
  onDidChange: vscode.Event<void>;
}
interface Change {
  uri: vscode.Uri;
  originalUri: vscode.Uri;
  renameUri: vscode.Uri | undefined;
  status: number;
}

export class GitService implements vscode.Disposable {
  private readonly _onDidMergeStateChange = new vscode.EventEmitter<MergeChange[]>();
  readonly onDidMergeStateChange = this._onDidMergeStateChange.event;

  private gitAPI: GitAPI | undefined;
  private repoDisposable: vscode.Disposable | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(this._onDidMergeStateChange);
    this.init();
  }

  private init(): void {
    const ext = vscode.extensions.getExtension<GitExtensionAPI>('vscode.git');
    if (!ext) {
      vscode.window.showWarningMessage('MergePro: Git extension not found.');
      return;
    }
    const activate = ext.isActive
      ? Promise.resolve(ext.exports)
      : ext.activate();

    activate.then((exports) => {
      this.gitAPI = exports.getAPI(1);
      this.watchRepositories();
    });

    // Re-try if git extension activates later
    this.disposables.push(
      vscode.extensions.onDidChange(() => {
        if (!this.gitAPI) this.init();
      }),
    );
  }

  private watchRepositories(): void {
    if (!this.gitAPI) return;

    for (const repo of this.gitAPI.repositories) {
      this.watchRepo(repo);
    }

    this.disposables.push(
      this.gitAPI.onDidOpenRepository((repo) => this.watchRepo(repo)),
    );
  }

  private watchRepo(repo: Repository): void {
    this.repoDisposable?.dispose();
    this.repoDisposable = repo.state.onDidChange(() => {
      this._onDidMergeStateChange.fire(this.toMergeChanges(repo));
    });
    this.disposables.push(this.repoDisposable);
    // Fire immediately to populate initial state
    this._onDidMergeStateChange.fire(this.toMergeChanges(repo));
  }

  private toMergeChanges(repo: Repository): MergeChange[] {
    return repo.state.mergeChanges.map((c) => ({
      uri: c.uri,
      fileName: vscode.workspace.asRelativePath(c.uri),
    }));
  }

  getMergeChanges(): MergeChange[] {
    if (!this.gitAPI) return [];
    const repo = this.gitAPI.repositories[0];
    if (!repo) return [];
    return this.toMergeChanges(repo);
  }

  async getFileContents(uri: vscode.Uri, stage: 1 | 2 | 3): Promise<string> {
    // Use git index URI scheme: git:<path>?{"path":"...","ref":":N"}
    const gitUri = uri.with({
      scheme: 'git',
      query: JSON.stringify({ path: uri.fsPath, ref: `:${stage}` }),
    });
    const bytes = await vscode.workspace.fs.readFile(gitUri);
    return Buffer.from(bytes).toString('utf8');
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
