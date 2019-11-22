const connectivityModule = require("tns-core-modules/connectivity");
const fileSystemModule = require("tns-core-modules/file-system");
const httpModule = require("tns-core-modules/http");
const Toast = require("nativescript-toast");
import { TnsOAuthClient } from "nativescript-oauth2";
import { localize } from "nativescript-localize";

export default class GoogleDriveProvider {

    loginGoogleDriveIfNeeded() {
        return new Promise((resolve, reject) => {
            this.client = new TnsOAuthClient("google");

            const noNeedToLoginAgain = this.isLoggedInGoogleDrive();
            if (noNeedToLoginAgain) {
                const currentAppFolder = fileSystemModule.knownFolders.currentApp();
                const credentialsPath = fileSystemModule.path.join(currentAppFolder.path, 'configuration', 'google_credentials.cfg');
                const credentialsFile = fileSystemModule.File.fromPath(credentialsPath);
                credentialsFile.readText()
                .then((res) => {
                    const content = JSON.parse(res);
                    this.googleDriveTokens = content;
                    resolve();
                }).catch((err) => {
                    console.error('Failed to read Google Drive configuration file !');
                    reject(err);
                });
                return;
            }
            
            const type = connectivityModule.getConnectionType();
            const noInternetConnection = type === connectivityModule.connectionType.none;
            if (noInternetConnection) {
                alert({
                    title: localize('no_internet_title'),
                    message: localize('no_internet_message'),
                    okButtonText: localize('ok_button')
                }).then(() => {
                    reject('no internet connection');
                })
                return;
            }

            setTimeout(() => {
                this.client.loginWithCompletion((tokenResult, error) => {
                    if (error) {
                        reject(error);
                    } else {
                        this.googleDriveTokens = tokenResult;

                        const credentialsFile = this._getGoogleDriveConfigurationFile();

                        credentialsFile.writeText(JSON.stringify(tokenResult))
                        .then((result) => {
                            console.log('Successfully written Google Drive access in configuration file.')
                        }).catch((err) => {
                            console.error('Failed to save Google Drive access in configuration file !');
                            reject(err);
                        });

                        resolve();
                    }
                });
            });
        })
    }

    logoutGoogleDrive() {
        return new Promise((resolve, reject) => {
            const credentialsFile = this._getGoogleDriveConfigurationFile();
            credentialsFile.remove()
            .then((res) => {
                console.log("Google Drive configuration file successfully deleted.");
                resolve();
            }).catch((err) => {
                reject("Failed to remove Google Drive configuration file !");
            });
        });
    }

    isLoggedInGoogleDrive() {
        const currentAppFolder = fileSystemModule.knownFolders.currentApp();
        const credentialsPath = fileSystemModule.path.join(currentAppFolder.path, 'configuration', 'google_credentials.cfg');

        return fileSystemModule.File.exists(credentialsPath);
    }

    /*
        Access configuration file and creates it if not present.
    */
    _getGoogleDriveConfigurationFile() {
        const currentAppFolder = fileSystemModule.knownFolders.currentApp();
        const credentialsPath = fileSystemModule.path.join(currentAppFolder.path, 'configuration', 'google_credentials.cfg');
        return fileSystemModule.File.fromPath(credentialsPath);
    }

    logoutGoogleDrive() {
        this.googleDriveTokens = null;
        
        const credentialsFile = this._getGoogleDriveConfigurationFile();

        credentialsFile.remove()
        .then((res) => {
            console.log('Successfully removed Google Drive crendentials file.');
        }).catch((err) => {
            console.error('Failed to delete Google Drive credentials file.');
            console.error(err);
        });

        if (this.client) {
            this.client.logout();
        }
    }

    getGoogleDriveRootFiles() {
        return new Promise((resolve, reject) => {
            const order = 'folder,name_natural';
            const fields = 'files(id,name,mimeType,fileExtension)';
            const filter = this._escapeHtml("trashed = false and 'root' in parents and (mimeType = 'application/vnd.google-apps.folder' or fileExtension = 'pgn')");

            httpModule.request({
                url: `https://www.googleapis.com/drive/v3/files?corpora=user&orderBy=${order}&fields=${fields}&q=${filter}&pageSize=20`,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.googleDriveTokens.accessToken}`,
                },
            }).then((response) => {
                resolve(response['content'].toJSON()['files']);
            }, (e) => {
                reject(e);
            });
        });
    }

    getGoogleDriveInnerFolderFiles(folderId) {
        return new Promise((resolve, reject) => {
            const order = 'folder,name_natural';
            const fields = 'files(id,name,mimeType,fileExtension)';
            const filter = this._escapeHtml(`trashed = false and '${folderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or fileExtension = 'pgn')`);

            httpModule.request({
                url: `https://www.googleapis.com/drive/v3/files?corpora=user&orderBy=${order}&fields=${fields}&q=${filter}&pageSize=20`,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.googleDriveTokens.accessToken}`,
                },
            }).then((response) => {
                resolve(response['content'].toJSON()['files']);
            }, (e) => {
                reject(e);
            });
        });
    }

    getGoogleDriveFileSimpleNameWithExtension(fileId) {
        return new Promise((resolve, reject) => {
            const fields = 'name';

            httpModule.request({
                url: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.googleDriveTokens.accessToken}`,
                },
            }).then((response) => {
                resolve(response);
            }, (e) => {
                reject(e);
            });
        });
    }

    downloadGoogleDriveFileIntoPath({fileId, destinationPath, mustNotifyUser}) {
        return new Promise((resolve, reject) => {
            httpModule.request({
                url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.googleDriveTokens.accessToken}`,
                },
            }).then(async(response) => {
                try {
                    const simpleFileNameData = await this.getGoogleDriveFileSimpleNameWithExtension(fileId);
                    const simpleFileName = simpleFileNameData['content'].toJSON()['name'];
                    const tempFileData = response['content'].toFile();
                    const tempFilePath = tempFileData.path;

                    const tempFile = fileSystemModule.File.fromPath(tempFilePath);
                    const copiedFilePath = fileSystemModule.path.join(destinationPath, simpleFileName);
                    const copiedFile = fileSystemModule.File.fromPath(copiedFilePath);

                    tempFile.readText().then((result) => {
                        copiedFile.writeText(result).then((saveResult) => {
                            console.log(`File ${simpleFileName} copied with success into folder ${destinationPath}.`);
                            if (mustNotifyUser) {
                                const toast = Toast.makeText(localize('copied_cloud_file_in_local_storage', simpleFileName));
                                toast.show();
                            }
                        });
                    });
                    resolve(response);
                }
                catch (e) {
                    reject(e);
                }
            }, (e) => {
                reject(e);
            });
        });
    }

    downloadGoogleDriveFolderIntoPath({folderId, destinationPath, mustNotifyUser}) {
        return new Promise(async (resolve, reject) => {
            try {
                const newFolderData = await this._getGoogleDriveFolderElementData(folderId);
                if (newFolderData.mimeType !== 'application/vnd.google-apps.folder') {
                    reject('Requested element is not a folder !');
                }
                
                const newFolderName = newFolderData.name;
                const newFolderPath = fileSystemModule.path.join(destinationPath, newFolderName);
                fileSystemModule.Folder.fromPath(newFolderPath); // Creates folder

                const folderElements = await this.getGoogleDriveInnerFolderFiles(folderId);
                
                folderElements.forEach(async element => {
                    try {
                        await this._downloadGoogleDriveFolderElement(element.id, newFolderPath);
                    }
                    catch (e) {
                        reject(e);
                    }
                });

                console.log(`Folder ${newFolderName} copied with success in ${destinationPath}`);
                if (mustNotifyUser) {
                    const toast = Toast.makeText(localize('copied_cloud_folder_in_local_storage', newFolderName));
                    toast.show();
                }              
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }

    _downloadGoogleDriveFolderElement(elementId, destinationPath) {
        return new Promise(async (resolve, reject) => {
            try {
                const elementData = await this._getGoogleDriveFolderElementData(elementId);
                const isFolder = elementData.mimeType === 'application/vnd.google-apps.folder';

                if (isFolder) {
                    await this.downloadGoogleDriveFolderIntoPath({folderId: elementId, destinationPath, mustNotifyUser: false});
                }
                else {
                    await this.downloadGoogleDriveFileIntoPath({fileId: elementId, destinationPath, mustNotifyUser: false});
                }

                resolve();
            }
            catch (e) {
                reject(e);
            }
        });
    }

    _getGoogleDriveFolderElementData(elementId) {
        return new Promise((resolve, reject) => {
            const fields = 'id,name,mimeType';
            httpModule.request({
                url: `https://www.googleapis.com/drive/v3/files/${elementId}?fields=${fields}`,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.googleDriveTokens.accessToken}`,
                },
            }).then((response) => {
                resolve(response['content'].toJSON());
            }, (e) => {
                reject(e);
            });
        });
    }

    _escapeHtml(string) {
        let result = string;
        result = result.replace(/!/g, '%21');
        result = result.replace(/=/g, '%3d');
        result = result.replace(/ /g, '+');

        return result;
    }
};