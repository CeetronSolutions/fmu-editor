import {Button} from "@mui/material";
import {notificationsService} from "@services/notifications-service";

import React from "react";
import {VscFolder} from "react-icons/vsc";

import {useAppSelector} from "@redux/hooks";

import {NotificationType} from "@shared-types/notifications";

import path from "path";

export const WorkingDirectory: React.FC = () => {
    const workingDirectoryPath = useAppSelector(state => state.files.workingDirectoryPath);

    const handleOpenDirectoryClick = () => {
        notificationsService.publishNotification({
            type: NotificationType.INFORMATION,
            message: `'${workingDirectoryPath}' is your current working directory. It can be changed in the file explorer.`,
        });
    };
    return (
        <Button size="small" onClick={handleOpenDirectoryClick} title="Current working directory.">
            <VscFolder />
            <span>
                {workingDirectoryPath === "" ? (
                    <i>No working directory selected</i>
                ) : (
                    path.basename(workingDirectoryPath)
                )}
            </span>
        </Button>
    );
};
