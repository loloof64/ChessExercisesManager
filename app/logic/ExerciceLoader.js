const fileSystemModule = require("tns-core-modules/file-system");
import { localize } from "nativescript-localize";

export default class ExerciseLoader {

    
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

}