import {IDynamicPerson} from "@microsoft/mgt-components";
import {useFileManager} from "@services/file-manager";

import React from "react";

import {File} from "@utils/file-system/file";

import {Avatar} from "@components/MicrosoftGraph/Avatar";

import {useAppDispatch, useAppSelector} from "@redux/hooks";
import {setDiffUserFile} from "@redux/reducers/ui";

import {FileChange, FileChangeOrigin} from "@shared-types/file-changes";

import path from "path";

export type UserChangesBrowserItemProps = {
    change: FileChange;
};

export const OngoingChangesBrowserItem: React.FC<UserChangesBrowserItemProps> = props => {
    const [userDetails, setUserDetails] = React.useState<IDynamicPerson | null>(null);
    const {fileManager} = useFileManager();
    const directory = useAppSelector(state => state.files.directory);
    const diffUserFile = useAppSelector(state => state.ui.diffUserFile);

    const dispatch = useAppDispatch();

    const handleClick = (filePath: string, user: string) => {
        const file = new File(filePath, directory);
        dispatch(
            setDiffUserFile({
                userFile: file.getUserVersion(user).relativePath(),
                origin: FileChangeOrigin.USER,
            })
        );
    };

    return (
        <a
            className={`OngoingChangesBrowserItem${
                fileManager.getUserFileIfExists(path.join(directory, props.change.relativePath), props.change.user) ===
                diffUserFile
                    ? " OngoingChangesBrowserItem--selected"
                    : ""
            }`}
            onClick={() => handleClick(props.change.relativePath, props.change.user)}
        >
            <Avatar user={props.change.user} size={40} getDetails={(_, details) => setUserDetails(details)} />
            <div>
                <div className="TextOverflow" title={userDetails?.displayName || props.change.user}>
                    {userDetails?.displayName || props.change.user}
                </div>
                {props.change.modified && (
                    <div className="ChangesBrowserDate">
                        authored {new Date(props.change.modified).toLocaleDateString()}
                        {" @ "}
                        {new Date(props.change.modified).toLocaleTimeString()}
                    </div>
                )}
            </div>
        </a>
    );
};
