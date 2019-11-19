const fileSystemModule = require("tns-core-modules/file-system");
const connectivityModule = require("tns-core-modules/connectivity");
const httpModule = require("tns-core-modules/http");
import { localize } from "nativescript-localize";
import { TnsOAuthClient } from "nativescript-oauth2";

export default class ExerciseLoader {

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

    async loadSampleExercise(scriptFileName) {
        const currentAppFolder = fileSystemModule.knownFolders.currentApp();
        const path = fileSystemModule.path.join(currentAppFolder.path, 'sample_exercises', scriptFileName);
        return await this.loadExerciseFromAbsolutePath(path);
    }

    async loadExerciseFromAbsolutePath(absolutePath) {
        const file = fileSystemModule.File.fromPath(absolutePath);
        const input = await file.readText();

        const inputLines = input.split(/\r?\n/);

        const fenLine = inputLines.find(line => line.startsWith('[FEN'));
        if (fenLine === undefined) throw localize('no_fen_line_error');
        
        // Removes the first part of the string
        let result = fenLine.split(' ').slice(1).join(' ');
        // Removes the last ']'
        result = result.substring(0, result.length - 1);
        // Removes both '"'
        return result.substring(1, result.length - 1);
    }

    loadGoogleDriveRootFiles() {
        return new Promise((resolve, reject) => {
            const order = 'folder,name_natural';
            const fields = 'files(id,name,mimeType)';
            const filter = this._escapeHtml('');
            httpModule.request({
                url: `https://www.googleapis.com/drive/v3/files?corpora=user&orderBy=${order}&fields=${fields}&q=${filter}&pageSize=20`,
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

    _escapeHtml(string) {
        let result = string;
        result = result.replace(/!/g, '%21');
        result = result.replace(/=/g, '%3d');
        result = result.replace(/'/g, '%27');

        return result;
    }

}