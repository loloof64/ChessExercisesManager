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
                url: `https://www.googleapis.com/drive/v3/files?corpora=user&orderBy=${order}&fields=${fields}&q=${filter}`,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.googleDriveTokens.accessToken}`,
                },
            }).then((response) => {
                resolve(response['content'].toJSON()['files']);
            }, (e) => {
                console.error(e);
                reject(e);
            });
        });
    }

    async getGoogleDriveInnerFolderFiles(folderId) {
        const that = this;
        function baseRequest() {
            return new Promise((resolve, reject) => {
                const order = 'folder,name_natural';
                const fields = 'files(id,name,mimeType,fileExtension)';
                const filter = that._escapeHtml(`trashed = false and '${folderId}' in parents and (mimeType = 'application/vnd.google-apps.folder' or fileExtension = 'pgn')`);
    
                httpModule.request({
                    url: `https://www.googleapis.com/drive/v3/files?corpora=user&orderBy=${order}&fields=${fields}&q=${filter}`,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${that.googleDriveTokens.accessToken}`,
                    },
                }).then((response) => {
                    resolve(response);
                }, (e) => {
                    console.error(e);
                    reject(e);
                });
            });
        }
    

        // Retries as many times as needed
        let waitingTimesMs = []
        for (let i = 0; i < 30; i++){
            waitingTimesMs.push(parseInt(1000 + 5000*Math.random()));
        }
        for (let waitingTime of waitingTimesMs) {
            try {
                setTimeout(() => {}, waitingTime);
                const response = await baseRequest();
                const responseIsGood = response.statusCode !== 403;
                if (responseIsGood) {
                    return response['content'].toJSON()['files'];
                }
            }
            catch (e) {
                console.error(e);
            }
        }

        console.error(`Failed to get Google Drive elements of folder ${folderId}`);
    }

    async getGoogleDriveFileSimpleNameWithExtension(fileId) {
        const that = this;
        function baseRequest() {
            return new Promise((resolve, reject) => {
                const fields = 'name';
    
                httpModule.request({
                    url: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${that.googleDriveTokens.accessToken}`,
                    },
                }).then((response) => {
                    resolve(response);
                }, (e) => {
                    console.error(e);
                    reject(e);
                });
            });
        }

        // Retries as many times as needed
        let waitingTimesMs = []
        for (let i = 0; i < 30; i++){
            waitingTimesMs.push(parseInt(1000 + 5000*Math.random()));
        }
        for (let waitingTime of waitingTimesMs) {
            try {
                setTimeout(() => {}, waitingTime);
                const response = await baseRequest();
                const responseIsGood = response.statusCode !== 403;
                if (responseIsGood) {
                    return response['content'].toJSON()['name'];
                }
            }
            catch (e) {
                console.error(e);
            }
        }

        console.error(`Failed to get name of Google Drive element ${fileId}`);
    }

    async downloadGoogleDriveFileIntoPath({fileId, destinationPath, mustNotifyUser, overwrite}) {
        const that = this;
        function baseRequest() {
            return new Promise((resolve, reject) => {
                httpModule.request({
                    url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${that.googleDriveTokens.accessToken}`,
                    },
                }).then(async(response) => {
                    resolve(response);
                }, (e) => {
                    console.error(e);
                    reject(e);
                });
            });
        }

        async function copyContentToLocalFile(requestResponse) {
            try {
                const simpleFileName = await that.getGoogleDriveFileSimpleNameWithExtension(fileId);
                
                const filePath = fileSystemModule.path.join(destinationPath, simpleFileName);
                const fileAlreadyExists = fileSystemModule.File.exists(filePath);
                if (fileAlreadyExists && !overwrite) return;

                const tempFileData = requestResponse['content'].toFile();
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
            }
            catch (e) {
                console.error(e);
            }
        }

        // Retries as many times as needed
        let waitingTimesMs = []
        for (let i = 0; i < 30; i++){
            waitingTimesMs.push(parseInt(1000 + 5000*Math.random()));
        }
        for (let waitingTime of waitingTimesMs) {
            try {
                setTimeout(() => {}, waitingTime);
                const response = await baseRequest();
                const responseIsGood = response.statusCode !== 403;
                if (responseIsGood) {
                    await copyContentToLocalFile(response);
                }
            }
            catch (e) {
                console.error(e);
            }
        }

        console.error(`Failed to download Google Drive file ${fileId}`);
    }

    downloadGoogleDriveFolderIntoPath({folderId, destinationPath, mustNotifyUser}) {
        return new Promise(async (resolve, reject) => {
            try {
                const newFolderData = await this._getGoogleDriveFolderElementData(folderId);
                if (newFolderData.mimeType !== 'application/vnd.google-apps.folder') {
                    reject(`Requested element ${newFolderData.name} is not a folder !`);
                }
                
                const newFolderName = newFolderData.name;
                const newFolderPath = fileSystemModule.path.join(destinationPath, newFolderName);
                fileSystemModule.Folder.fromPath(newFolderPath); // Creates folder

                const folderElements = await this.getGoogleDriveInnerFolderFiles(folderId);
                
                const folderElementsRequests = folderElements.map(element => {
                    return this._downloadGoogleDriveFolderElement(element.id, newFolderPath);
                });

                const elementsCount = folderElements.length;
                const result = await Promise.all(folderElementsRequests);
                const successCount = result.reduce((accum, value) => {
                    return value ? accum + 1 : accum;
                }, 0);

                if (successCount === elementsCount) {
                    console.log(`Folder ${newFolderName} copied with success in ${destinationPath}`);
                    if (mustNotifyUser) {
                        const toast = Toast.makeText(localize('copied_cloud_folder_in_local_storage', newFolderName));
                        toast.show();
                    }              
                    resolve();
                }
                else{
                    console.log(`Failed to copy folder ${newFolderName} in ${destinationPath}`);
                    if (mustNotifyUser) {
                        const toast = Toast.makeText(localize('failure_copy_cloud_folder_in_local_storage', newFolderName));
                        toast.show();
                    }   
                    reject(e);
                }
            }
            catch (err) {
                console.error(err);
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

                resolve(true);
            }
            catch (e) {
                console.error(e);
                reject(e);
            }
        });
    }

    async _getGoogleDriveFolderElementData(elementId) {
        const that = this;
        function baseRequest() {
            return new Promise((resolve, reject) => {
                const fields = 'id,name,mimeType';
                httpModule.request({
                    url: `https://www.googleapis.com/drive/v3/files/${elementId}?fields=${fields}`,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${that.googleDriveTokens.accessToken}`,
                    },
                }).then((response) => {
                    resolve(response);
                }, (e) => {
                    console.error(e);
                    reject(e);
                });
            });
        }
    

        // Retries as many times as needed
        let waitingTimesMs = []
        for (let i = 0; i < 30; i++){
            waitingTimesMs.push(parseInt(1000 + 5000*Math.random()));
        }
        for (let waitingTime of waitingTimesMs) {
            try {
                setTimeout(() => {}, waitingTime);
                const response = await baseRequest();
                const responseIsGood = response.statusCode !== 403;
                if (responseIsGood) {
                    return response['content'].toJSON();
                }
            }
            catch (e) {
                console.error(e);
            }
        }

        console.error(`Failed to get Google Drive data of element ${elementId}`);
    }

    _escapeHtml(string) {
        let result = string;
        result = result.replace(/!/g, '%21');
        result = result.replace(/=/g, '%3d');
        result = result.replace(/ /g, '+');

        return result;
    }
};