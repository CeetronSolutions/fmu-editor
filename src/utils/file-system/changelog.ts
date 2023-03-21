/* eslint-disable max-classes-per-file */
import {ICommit, IGlobalChangelog, ILocalChangelog, ISnapshotCommitBundle} from "@shared-types/changelog";
import { DIRECTORY_PATHS, SYSTEM_FILES } from "@global/constants";

import fs from "fs";
import path from "path";

class DirectoryNotSetError extends Error {
    constructor() {
        super("Changelog directory not set");
        this.name = "DirectoryNotSetError";
    }
}

export class Changelog {
    private workingDirectory: string | null;
    private changelog: IGlobalChangelog | null;

    constructor(directory: string | null = null) {
        this.workingDirectory = directory;
        this.changelog = null;
        this.maybeRefresh();
    }

    public isInitialized(): boolean {
        return this.workingDirectory !== null;
    }

    public modifiedTimestamp(): number {
        if (!this.workingDirectory) {
            return 0;
        }

        this.createLocalChangelogFileIfNotExists();
        if (!this.changelog) {
            return 0;
        }

        return this.changelog.modified;
    }

    public setWorkingDirectory(directory: string) {
        this.workingDirectory = directory;
        this.changelog = null;
        this.maybeRefresh();
    }

    private localChangelogPath(): string {
        if (!this.workingDirectory) {
            throw new DirectoryNotSetError();
        }
        return path.join(this.workingDirectory, SYSTEM_FILES.CHANGELOG);
    }

    private getRelativeFilePath(filePath: string): string {
        if (!this.workingDirectory) {
            return filePath;
        }

        return path.relative(this.workingDirectory, filePath);
    }

    private snapshotsPath(): string {
        if (!this.workingDirectory) {
            throw new DirectoryNotSetError();
        }
        return path.join(this.workingDirectory, DIRECTORY_PATHS.SNAPSHOTS);
    }

    private static changelogIsCorrectlyFormatted(content: any): boolean {
        return (
            content &&
            content.created &&
            content.directory &&
            content.modified &&
            content.log &&
            Array.isArray(content.log)
        );
    }

    private createLocalChangelogFileIfNotExists(): boolean {
        if (!this.workingDirectory) {
            return false;
        }

        if (fs.existsSync(this.localChangelogPath())) {
            const content = JSON.parse(fs.readFileSync(this.localChangelogPath()).toString());
            if (Changelog.changelogIsCorrectlyFormatted(content)) {
                return false;
            }
        }

        const currentTimestamp = new Date().getTime();

        const currentChangelog: ILocalChangelog = {
            created: currentTimestamp,
            directory: this.workingDirectory,
            modified: currentTimestamp,
            log: [],
        };
        fs.writeFileSync(this.localChangelogPath(), JSON.stringify(currentChangelog));
        return true;
    }

    public maybeRefresh() {
        if (!this.workingDirectory) {
            return;
        }

        this.createLocalChangelogFileIfNotExists();

        const content = JSON.parse(fs.readFileSync(this.localChangelogPath()).toString());

        this.changelog = {
            created: content.created,
            directory: content.directory,
            modified: content.modified,
            log: [
                ...this.getSnapshotCommits(),
                {
                    snapshotPath: null,
                    modified: content.modified,
                    commits: content.log,
                },
            ],
        };
    }

    public get(): IGlobalChangelog {
        this.createLocalChangelogFileIfNotExists();
        if (!this.changelog) {
            throw new Error("Changelog not initialized");
        }
        return this.changelog;
    }

    private getSnapshotCommits: () => ISnapshotCommitBundle[] = () => {
        if (!this.workingDirectory) {
            return [];
        }

        if (!fs.existsSync(this.snapshotsPath())) {
            return [];
        }

        const snapshotFolders = fs.readdirSync(this.snapshotsPath()).filter(item => !/(^|\/)\.[^\/\.]/g.test(item));
        const snapshots: ISnapshotCommitBundle[] = [];
        snapshotFolders.forEach(folder => {
            const snapshotPath = path.join(this.snapshotsPath(), folder, SYSTEM_FILES.CHANGELOG);
            if (!fs.existsSync(snapshotPath)) {
                return;
            }
            const snapshotChangelog = JSON.parse(fs.readFileSync(snapshotPath).toString());
            snapshots.push({
                snapshotPath: path.join(this.snapshotsPath(), folder),
                modified: fs.statSync(snapshotPath).mtime.getTime(),
                commits: snapshotChangelog.log,
            });
        });

        return snapshots;
    };

    public saveLocalChangelog(): boolean {
        if (!this.workingDirectory) {
            return false;
        }

        if (!this.changelog) {
            return false;
        }

        const localChangelog: ILocalChangelog = {
            created: this.changelog.created,
            directory: this.changelog.directory,
            modified: new Date().getTime(),
            log: this.changelog.log
                .filter(bundle => bundle.snapshotPath === null)
                .map(bundle => bundle.commits)
                .flat(),
        };

        try {
            fs.writeFileSync(this.localChangelogPath(), JSON.stringify(localChangelog));
            return true;
        } catch (_) {
            return false;
        }
    }

    public appendCommit(commit: ICommit): boolean {
        if (!this.workingDirectory) {
            return false;
        }

        this.createLocalChangelogFileIfNotExists();
        if (!this.changelog) {
            return false;
        }

        const localChangelog = this.changelog.log.find(bundle => bundle.snapshotPath === null);
        if (!localChangelog) {
            return false;
        }

        localChangelog.commits.push(commit);
        this.changelog.modified = new Date().getTime();
        return this.saveLocalChangelog();
    }

    public getChangesForFile(filePath: string): ISnapshotCommitBundle[] {
        if (!filePath || filePath === "") {
            return [];
        }
        if (!this.workingDirectory) {
            return [];
        }

        this.createLocalChangelogFileIfNotExists();
        if (!this.changelog) {
            return [];
        }

        const bundles: ISnapshotCommitBundle[] = [];

        this.changelog.log.forEach(bundle => {
            const commits = bundle.commits.filter(commit =>
                commit.files.some(el => el.path === this.getRelativeFilePath(filePath))
            );
            if (commits.length > 0) {
                bundles.push({
                    snapshotPath: bundle.snapshotPath,
                    modified: bundle.modified,
                    commits: [...commits].reverse(),
                });
            }
        });

        return bundles.sort((a, b) => b.modified - a.modified);
    }

    public getAllChanges(): ISnapshotCommitBundle[] {
        if (!this.workingDirectory) {
            return [];
        }

        this.createLocalChangelogFileIfNotExists();
        if (!this.changelog) {
            return [];
        }

        const bundles: ISnapshotCommitBundle[] = [];

        this.changelog.log.forEach(bundle => {
            const commits = bundle.commits;
            bundles.push({
                snapshotPath: bundle.snapshotPath,
                modified: bundle.modified,
                commits: [...commits].reverse(),
            });
        });

        return bundles.sort((a, b) => b.modified - a.modified);
    }
}
