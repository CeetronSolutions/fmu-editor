import {useYamlSchemas} from "@hooks/useYamlSchema";
import {Close} from "@mui/icons-material";
import {IconButton, useTheme} from "@mui/material";
import useSize from "@react-hook/size";
import {useFileManager} from "@services/file-manager";

import React from "react";
import {DiffEditorDidMount, MonacoDiffEditor, monaco} from "react-monaco-editor";

import {useGlobalSettings} from "@components/GlobalSettingsProvider/global-settings-provider";
import {Surface} from "@components/Surface";

import {useAppDispatch, useAppSelector} from "@redux/hooks";
import {setActiveDiffFile} from "@redux/reducers/files";
import {addNotification} from "@redux/reducers/notifications";
import {setOngoingChangesFile, setView} from "@redux/reducers/ui";

import {NotificationType} from "@shared-types/notifications";
import {View} from "@shared-types/ui";

import fs from "fs";
// @ts-ignore
import {languages} from "monaco-editor";
import path from "path";

import "./diff-editor.css";

declare global {
    interface Window {
        MonacoEnvironment?: monaco.Environment;
    }
}

window.MonacoEnvironment = {
    getWorker(moduleId, label) {
        switch (label) {
            case "editorWorkerService":
                return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url));
            case "css":
            case "less":
            case "scss":
                return new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker", import.meta.url));
            case "handlebars":
            case "html":
            case "razor":
                return new Worker(new URL("monaco-editor/esm/vs/language/html/html.worker", import.meta.url));
            case "json":
                return new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker", import.meta.url));
            case "javascript":
            case "typescript":
                return new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker", import.meta.url));
            case "yaml":
                return new Worker(new URL("monaco-yaml/yaml.worker", import.meta.url));
            default:
                throw new Error(`Unknown label ${label}`);
        }
    },
};

// @ts-ignore
const {yaml} = languages || {};

export const DiffEditor: React.VFC = () => {
    const [visible, setVisible] = React.useState<boolean>(false);
    const [originalFilePath, setOriginalFilePath] = React.useState<string | null>(null);
    const [userFilePath, setUserFilePath] = React.useState<string | null>(null);
    const [originalEditorWidth, setOriginalEditorWidth] = React.useState<number>(0);

    const monacoDiffEditorRef = React.useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
    const diffEditorRef = React.useRef<HTMLDivElement | null>(null);
    const monacoDiffRef = React.useRef<typeof monaco | null>(null);

    const [diffEditorTotalWidth, diffEditorTotalHeight] = useSize(diffEditorRef);

    const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const theme = useTheme();

    const fontSize = useAppSelector(state => state.ui.settings.editorFontSize);
    const activeDiffFile = useAppSelector(state => state.files.activeDiffFile);
    const activeOngoingChangesDiffFile = useAppSelector(state => state.files.activeOngoingChangesDiffFile);
    const currentCommit = useAppSelector(state => state.ui.currentCommit);
    const currentDirectory = useAppSelector(state => state.files.directory);
    const ongoingChangesFile = useAppSelector(state => state.ui.ongoingChangesFile);
    const view = useAppSelector(state => state.ui.view);
    const dispatch = useAppDispatch();
    const {fileManager} = useFileManager();
    const globalSettings = useGlobalSettings();

    useYamlSchemas(yaml);

    React.useEffect(() => {
        const timeoutRef = timeout.current;
        return () => {
            if (timeoutRef) {
                clearTimeout(timeoutRef);
            }
        };
    }, [timeout]);

    const handleDiffEditorDidMount: DiffEditorDidMount = (editor, monacoInstance) => {
        monacoDiffEditorRef.current = editor;
        monacoDiffRef.current = monacoInstance;
        editor.getOriginalEditor().onDidLayoutChange(handleLayoutChange);
    };

    React.useEffect(() => {
        if (!monacoDiffEditorRef || !monacoDiffEditorRef.current) {
            return;
        }
        monacoDiffEditorRef.current.updateOptions({fontSize: 12 * fontSize});
    }, [fontSize, monacoDiffEditorRef]);

    React.useEffect(() => {
        if (view === View.Main || view === View.SingleFileChanges) {
            if (activeDiffFile) {
                if (currentCommit) {
                    setUserFilePath(fileManager.makeOriginalFilePath(activeDiffFile, currentCommit.snapshotPath));
                    if (currentCommit.compareSnapshotPath !== undefined) {
                        setOriginalFilePath(
                            fileManager.makeOriginalFilePath(
                                activeDiffFile,
                                currentCommit.compareSnapshotPath ?? undefined
                            )
                        );
                    } else {
                        setOriginalFilePath(
                            fileManager.makeOriginalFilePath(activeDiffFile, currentCommit.snapshotPath)
                        );
                    }
                } else {
                    setUserFilePath(fileManager.getUserFileIfExists(path.join(currentDirectory, activeDiffFile)));
                    setOriginalFilePath(
                        fileManager.getOriginalFileIfExists(path.join(currentDirectory, activeDiffFile))
                    );
                }
            }
        } else if (ongoingChangesFile) {
            setUserFilePath(activeOngoingChangesDiffFile);
            setOriginalFilePath(fileManager.getOriginalFileIfExists(activeOngoingChangesDiffFile));
        }
    }, [
        activeDiffFile,
        currentCommit,
        currentDirectory,
        fileManager,
        ongoingChangesFile,
        view,
        activeOngoingChangesDiffFile,
    ]);

    React.useEffect(() => {
        if (
            !originalFilePath ||
            !userFilePath ||
            !globalSettings.supportedFileExtensions.includes(path.extname(originalFilePath))
        ) {
            monacoDiffEditorRef.current?.setModel({
                original: monaco.editor.createModel("", "yaml"),
                modified: monaco.editor.createModel("", "yaml"),
            });
            setVisible(false);
            if (
                originalFilePath &&
                userFilePath &&
                !globalSettings.supportedFileExtensions.includes(path.extname(originalFilePath))
            ) {
                dispatch(
                    addNotification({
                        type: NotificationType.INFORMATION,
                        message: `You can only use the diff editor for files with the following extensions: ${globalSettings.supportedFileExtensions.join(
                            ", "
                        )}`,
                    })
                );
            }
            return;
        }

        setVisible(true);

        if (userFilePath && originalFilePath) {
            let userModel = monaco.editor.getModel(monaco.Uri.file(userFilePath));
            if (!userModel) {
                userModel = monaco.editor.createModel(
                    fs.readFileSync(userFilePath).toString(),
                    globalSettings.languageForFileExtension(path.extname(userFilePath)),
                    monaco.Uri.file(userFilePath)
                );
            } else {
                userModel.setValue(fs.readFileSync(userFilePath).toString());
            }

            let diffModel = monaco.editor.getModel(monaco.Uri.file(originalFilePath));
            if (!diffModel) {
                diffModel = monaco.editor.createModel(
                    fs.readFileSync(originalFilePath).toString(),
                    globalSettings.languageForFileExtension(path.extname(userFilePath)),
                    monaco.Uri.file(originalFilePath)
                );
            } else {
                diffModel.setValue(fs.readFileSync(originalFilePath).toString());
            }
            if (userModel) {
                if (monacoDiffEditorRef.current && monacoDiffRef.current) {
                    monacoDiffEditorRef.current.setModel({
                        original: diffModel ?? userModel,
                        modified: userModel,
                    });
                    monacoDiffEditorRef.current.focus();
                }
            }
        }
    }, [
        activeDiffFile,
        currentCommit,
        currentDirectory,
        dispatch,
        fileManager,
        globalSettings.supportedFileExtensions,
        originalFilePath,
        userFilePath,
        globalSettings,
    ]);

    const handleClose = () => {
        dispatch(setActiveDiffFile({relativeFilePath: null}));
        dispatch(setOngoingChangesFile(undefined));
        dispatch(setView(View.Main));
        setVisible(false);
    };

    const handleLayoutChange = (layout: monaco.editor.EditorLayoutInfo) => {
        setOriginalEditorWidth(layout.contentWidth);
    };

    return (
        <div className="EditorWrapper">
            <div ref={diffEditorRef} className="EditorContainer" style={{display: visible ? "block" : "none"}}>
                <Surface elevation="raised" className="DiffEditorHeader">
                    <div style={{width: originalEditorWidth}}>
                        <strong>Original</strong> <i>({fileManager.relativeFilePath(originalFilePath || "")})</i>
                    </div>
                    <div style={{width: `calc(100% - 130px - ${originalEditorWidth}px)`}}>
                        <strong>Modified</strong> <i>({fileManager.relativeFilePath(userFilePath || "")})</i>
                    </div>
                    <IconButton onClick={() => handleClose()}>
                        <Close />
                    </IconButton>
                </Surface>
                <MonacoDiffEditor
                    language="yaml"
                    defaultValue=""
                    className="YamlEditor"
                    editorDidMount={handleDiffEditorDidMount}
                    theme={theme.palette.mode === "dark" ? "vs-dark" : "vs"}
                    options={{
                        readOnly: true,
                    }}
                    width={diffEditorTotalWidth}
                    height={diffEditorTotalHeight - 56}
                />
            </div>
        </div>
    );
};
