const fileSystemModule = require("tns-core-modules/file-system");
const connectivityModule = require("tns-core-modules/connectivity");
const httpModule = require("tns-core-modules/http");
import { localize } from "nativescript-localize";
import { TnsOAuthClient } from "nativescript-oauth2";

export default class ExerciseLoader {

    login() {
        return new Promise((resolve, reject) => {
            const noNeedToLoginAgain = this.client !== undefined;
            if (noNeedToLoginAgain) {
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
                    console.error('no internet connection');
                })
                return;
            }
            this.client = new TnsOAuthClient("google");

            setTimeout(() => {
                this.client.loginWithCompletion((tokenResult, error) => {
                    if (error) {
                        reject(error);
                    } else {
                        this.tokens = tokenResult;
                        resolve();
                    }
                });
            });
        })
    }

    logout() {
        this.tokens = null;
        this.client.logout();
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

    async loadExerciseFromGoogleDrive() {

    }

    loadGoogleDriveAboutData() {
        return new Promise((resolve, reject) => {
            httpModule.request({
                url: "https://www.googleapis.com/drive/v3/about?fields=*",
                method: "GET",
                headers: {
                    Authorization: `Bearer ${this.tokens.accessToken}`,
                },
            }).then((response) => {
                resolve(response);
            }, (e) => {
                reject(e);
            });
        });
    }

}