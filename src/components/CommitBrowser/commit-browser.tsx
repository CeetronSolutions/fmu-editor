import {useChangelogWatcher} from "@services/changelog-service";

import React from "react";

import {CommitList} from "@components/CommitList";
import {Surface} from "@components/Surface";

import {ISnapshotCommitBundle} from "@shared-types/changelog";

import "./commit-browser.css";

export const CommitBrowser: React.FC = () => {
    const [commitBundles, setCommitBundles] = React.useState<ISnapshotCommitBundle[]>([]);

    const changelogWatcher = useChangelogWatcher();

    React.useEffect(() => {
        changelogWatcher.getAllChanges();
        const handleChangelogModified = () => {
            changelogWatcher.getAllChanges();
        };
        document.addEventListener("changelog-modified", handleChangelogModified);

        return () => {
            document.removeEventListener("changelog-modified", handleChangelogModified);
        };
    }, [changelogWatcher]);

    React.useEffect(() => {
        setCommitBundles(changelogWatcher.allChanges);
    }, [changelogWatcher.allChanges]);

    return (
        <Surface elevation="none" className="CommitBrowser">
            <div className="CommitBrowserContent">
                <CommitList commitBundles={commitBundles} />
            </div>
        </Surface>
    );
};
