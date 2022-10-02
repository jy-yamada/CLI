const CliInput = document.getElementById("input");
const CliOutput = document.getElementById("output");

CliInput.focus();
CliInput.addEventListener("keyup", setEventToInput);

async function setEventToInput(event) {
    if (event.code == "Enter" && !event.isComposing)
    {
        const inputValue = CliInput.value;
        if (!isValidValue(inputValue)) return;
        CLI.echoInputValue(CliOutput);
        CliInput.value = "";
        
        const parsedInputArray = CLI.commandLineParser(inputValue);
        const validatorResponse = CLI.parsedArrayValidator(parsedInputArray);
        if (validatorResponse['isValid'] == false)
        {
            CLI.appendResultParagraph(CliOutput, false, validatorResponse["pack"], validatorResponse["errorMessage"]);
        }
        else
        {
            if (validatorResponse["pack"] == CRUD && parsedInputArray[0] == "rm") {
                CRUD.temp = parsedInputArray;
                CLI.appendResultParagraph(CliOutput, true, CRUD, "Are you sure? yes/no");
                CliInput.removeEventListener("keyup", setEventToInput);                
                CliInput.addEventListener("keyup", CRUDDeleteHelper);
            }
            else {
                const output = await validatorResponse["pack"].getResult(parsedInputArray);
                CLI.appendResultParagraph(CliOutput, true, validatorResponse["pack"], output);
            }
        }
        CliOutput.scrollTop = CliOutput.scrollHeight;
    }
    
    else if (event.code == "ArrowUp") {
        CLI.getInputHistories(-1);
    }
    
    else if (event.code == "ArrowDown") {
        CLI.getInputHistories(1);
    }
}

function CRUDDeleteHelper(event) {
    if (event.code == "Enter" && !event.isComposing) {
        const value = CliInput.value.toLowerCase();
        if (value == "no") {
            CLI.appendResultParagraph(CliOutput, true, CRUD, "Canceled the order");
        }
        else if (value == "yes") {
            const output = CRUD.getResult(CRUD.temp);
            CLI.appendResultParagraph(CliOutput, true, CRUD, output);
            CRUD.temp = [];
        }
        else {
            CLI.appendResultParagraph(CliOutput, true, CRUD, `Enter "yes" or "no"`);
        }
        CliInput.value = "";
        CliOutput.scrollTop = CliOutput.scrollHeight;
        if (value == "yes" || value == "no") {
            CliInput.removeEventListener("keyup", CRUDDeleteHelper);
            CliInput.addEventListener("keyup", setEventToInput);
        }
    }
}

function isValidValue(value) {
    let val = "";
    for (let i=0; i < value.length; i++) {
        if (value[i] == " ") continue;
        val += value[i];
    }
    return val != "";
}


class Directory {
    constructor(type, name, pass) {
        this.type = type;
        this.name = name;
        this.date = this.getDate();
        this.pass = pass;
        if (type == "file") this.content = "";
        else this.children = {};
    }

    getDate() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth()+1;
        const d = now.getDate();
        const hour = now.getHours();
        const min = now.getMinutes();
        const sec = now.getSeconds();
        return `${hour}:${min}:${sec} - ${y}/${m}/${d}`;
    }
}

class CRUD {
    static color = "purple";
    static commands = {
        touch:1,
        mkDir:1,
        ls:2,
        cd:1,
        pwd:0,
        print:1,
        setContent:10001,
        rm:1,
        copy:2,
        move:2,
    };
    static temp = [];

    static touch(parentDir, name) {
        const file = new Directory("file", name, `${parentDir.pass}${name}`);
        if (parentDir.children[name] != null
            && parentDir.children[name].type == "file")
        {
            file.content = parentDir.children[name].content;
            parentDir.children[name] = file;
            return `Updated file "${file.name}`;
            
        }
        parentDir.children[name] = file;
        return `Created file "${file.name}"`;
    }

    static mkDir(parentDir, name) {
        const dir = new Directory("directory", name, `${parentDir.pass}${name}/`);
        parentDir.children[name] = dir;
        return `Created directory "${dir.name}"`;
    }

    static ls(parentDir = null, name = null, options = []) {
        if (parentDir == null) return CRUD.lsHelper(CLI.currentDirectory.children, options);
        let children = parentDir.children;
        if (name == null) return CRUD.lsHelper(children, options);
        const child = children[name];
        if (child != null && child.type == "file") return `name | type | updated_date<br>${child.name} | ${child.type} | ${child.date}`;
        if (child != null) return CRUD.lsHelper(child.children, options);
        return CRUD.lsHelper(parentDir.children, options);
    }

    static lsHelper(objs, options = null) {
        const a = options.includes("a");
        const r = options.includes("r");
        const keys = [];
        for (const name in objs) keys.push(name);
        if (r) {
            keys.sort((a,b) => {
                if (a < b) return 1;
                if (a > b) return -1;
                return 0;
            });
        }
        else {
            keys.sort((a,b) => {
                if (a > b) return 1;
                if (a < b) return -1;
                return 0;
            });
        }
        
        let val = "name | type | updated_date";
        for (const name of keys) {
            const child = objs[name];
            if (!a && child.name[0] == ".") continue;
            val += `<br>${child.name} | ${child.type} | ${child.date}`;
        }
        return val;
    }

    static cd(parentDir, name) {
        if (parentDir == CLI.root && name == null) CLI.currentDirectory = CLI.root;
        else if (name == "..") CLI.currentDirectory = CRUD.getParentDirectory(parentDir.pass);
        else CLI.currentDirectory = parentDir.children[name];
        return `Changed directory to ${CLI.currentDirectory.name}`;
    }

    static pwd() {
        return CLI.currentDirectory.pass;
    }

    static print(parentDir, name) {
        const file = parentDir.children[name];
        return file.content;
    }

    static setContent(parentDir, name, content) {
        const targetDir =  parentDir.children[name]; 
        targetDir.content = content;
        targetDir.date = targetDir.getDate();
        return "Set the content.";
    }

    static rm(parentDir, name) {
        const type = parentDir.children[name].type;
        delete parentDir.children[name];
        return `Deleted ${type} "${name}"`;
    }

    static copy(parentDir, name, destinationDir) {
        const targetDir = parentDir.children[name];
        const copiedTargetDir = new Directory(targetDir.type, targetDir.name, targetDir.pass);
        if (targetDir.type == "file") copiedTargetDir.content = targetDir.content;
        const sourceQueue = [targetDir];
        const destinationQueue = [copiedTargetDir];

        while (sourceQueue.length > 0) {
            let sourceIterator = sourceQueue.shift();
            let destinationIterator = destinationQueue.shift();
            for (const name in sourceIterator.children) {
                const child = sourceIterator.children[name];
                destinationIterator.children[name] = new Directory(child.type, child.name, child.pass);
                if (child.type == "file") destinationIterator.children[name].content = child.content;
                sourceQueue.push(child);
                destinationQueue.push(destinationIterator.children[name]);
            }
        }
        destinationDir.children[name] = copiedTargetDir;
        return `Copied ${targetDir.type} "${targetDir.name}" to directory ${destinationDir.name}`;
    }
    
    static move(parentDir, name, destinationDir) {
        const targetDir = parentDir.children[name];
        destinationDir.children[name] = targetDir;
        delete parentDir.children[name];
        return `Moved ${targetDir.type} "${targetDir.name}" to directory ${destinationDir.name}`;
    }

    static getLastNameFromPass(pass) {
        if (pass == "/") return null;
        if (pass[pass.length-1] == "/") pass = pass.slice(0,pass.length-1);
        const passList = pass.split("/");
        return passList[passList.length-1];
    }

    static getParentDirectory(pass) {
        let iterator = CLI.root;
        if (pass == "/") return iterator;
        if (pass[0] != "/") iterator = CLI.currentDirectory;
        else pass = pass.slice(1);
        if (pass[pass.length-1] == "/") pass = pass.slice(0, pass.length-1);
        const passList = pass.split("/");
        while (passList.length > 1) {
            const target = passList.shift();
            if (!iterator.children[target]) return null;
            iterator = iterator.children[target];
        }
        return iterator;
    }

    static commandArgumentsValidator(parsedInputArray) {
        const commandsList1 = ["touch", "mkDir", "pwd"];
        const lsOptions = ["a", "r"];
        const forbiddenWords = ["-"];
        let validate = {'isValid':false, 'pack': CRUD, 'errorMessage': ''};
        const command = parsedInputArray[0];
        let parentDir;
        let lastPass;
        if (parsedInputArray[1] != null) {
            parentDir = CRUD.getParentDirectory(parsedInputArray[1]);
            if (parentDir == null) {
                validate.errorMessage = `Path is incorrect`; return validate;
            }
            lastPass = CRUD.getLastNameFromPass(parsedInputArray[1]);
        }

        if (command == "copy" || command == "move") {
            if (parentDir == CLI.root && lastPass == null) {
                validate.errorMessage = `Root directory cannot be copied or moved`; return validate;
            }
            if (lastPass != null && parentDir.children[lastPass] == null) {
                validate.errorMessage = `There's no such file or directory`; return validate;
            }
            const destinationParentDir = CRUD.getParentDirectory(parsedInputArray[2]);
            const destinationLastPass = CRUD.getLastNameFromPass(parsedInputArray[2]);
            if (destinationParentDir == null || (destinationLastPass != null && destinationParentDir.children[destinationLastPass] == null)) {
                validate.errorMessage = `There's no such directory`; return validate;
            }
            const destinationDir = destinationLastPass != null ? destinationParentDir.children[destinationLastPass] : destinationParentDir;
            if (parentDir == destinationDir) {
                validate.errorMessage = `Path is the same`; return validate;
            }
            if (destinationDir.children[lastPass]) {
                validate.errorMessage = `Same name ${destinationDir.children[lastPass].type} exists`; return validate;
            }
            if (destinationDir.type == "file") {
                validate.errorMessage = `Path is not to directory but file`; return validate;
            }
            validate.isValid = true; return validate;
        }

        let tailString = `exactly ${CRUD.commands[command]} arguments`;
        if (CRUD.commands[command] == 0) tailString = `no arguments`;
        if (CRUD.commands[command] == 1) tailString = `exactly 1 argument`;

        if (command != "setContent" && command != "ls" && parsedInputArray.length - 1 != CRUD.commands[command])
        {
            validate.errorMessage = `Command ${command} requires ${tailString}'`;
        }

        else if (command == "setContent"
                && (parsedInputArray.length - 1 > CRUD.commands[command] || parsedInputArray.length - 1 < 2))
        {
            validate.errorMessage = `Command ${command} requires 2 ~ ${CRUD.commands[command]} arguments'`;
        }

        else if (command == "ls") {
            if (parsedInputArray.length - 1 > CRUD.commands[command]) {
                validate.errorMessage = `Command ls requires 0 ~ ${CRUD.commands[command]} argument`; return validate;
            }
            let j = 0;
            for (let i=1; i < parsedInputArray.length; i++) {
                const argument = parsedInputArray[i];
                if (argument[0] == "-") {
                    if (argument.length -1 > lsOptions.length) { validate.errorMessage = `Incorrect options`; return validate; }

                    const usedOptions = [];
                    for (let j=1; j < argument.length; j++) {
                        if (!lsOptions.includes(argument[j]) || usedOptions.includes(argument[j])) { validate.errorMessage = `Incorrect options`; return validate; }
                        else usedOptions.push(argument[j]);
                    }
                }
                else {
                    j ++;
                    parentDir = CRUD.getParentDirectory(argument);
                    lastPass = CRUD.getLastNameFromPass(argument);
                    if (lastPass != null && parentDir.children[lastPass] == null && parsedInputArray.length - 1 == j) { validate.errorMessage = "There's no such file or directory"; return validate; }
                }
                if (j > 1) { validate.errorMessage = "Incorrect options"; return validate; }
            }
            validate.isValid = true; return validate;
        }

        else if ((command == "touch" || command == "mkDir") && forbiddenWords.includes(lastPass[0]))
        {
            validate.errorMessage = `File or directory name cannot start with "${lastPass[0]}"`; 
        }

        else if ((command == "touch" || command == "mkDir") && parentDir.type == "file")
        {
            validate.errorMessage = `Path is not to directory but file`; 
        }

        else if (command == "touch" && parentDir.children[lastPass]
                && parentDir.children[lastPass].type == "directory")
        {
            validate.errorMessage = `The same name directory exist. Try aother`;   
        }

        else if (command == "mkDir" && parentDir.children[lastPass])
        {
            if (parentDir.children[lastPass].type == "file")
            {
                validate.errorMessage = `The same name file exist. Try aother`;
            }
            else validate.errorMessage = `The same name directory exist. Try aother`;
        }

        else if ((command == "setContent" || command == "print")
                && (parentDir.children[lastPass] != null)
                && (parentDir.children[lastPass].type == "directory"))
        {
            validate.errorMessage = "Path is not to file but to directory";
        }

        else if (command == "cd" && (parsedInputArray[1] == ".." || parsedInputArray[1] == "/"))
        {
            validate.isValid = true;
        }

        else if (command == "cd"
                && parentDir.children[lastPass] != null
                && parentDir.children[lastPass].type == "file")
        {
            validate.errorMessage = `Path is not to directory but to file`;
        }
        
        else if (command == "rm" && parentDir == CLI.root && lastPass == null) {
            validate.errorMessage = `Root directory cannot be deleted`;
        }

        else if (!commandsList1.includes(command)
                && lastPass != null
                && parentDir.children[lastPass] == null)
        {
            validate.errorMessage = "There's no such file or directory";
        }

        else validate.isValid = true;
        return validate;
    }

    static getResult(parsedInputArray) {
        const command = parsedInputArray[0];
        let parentDir = parsedInputArray[1] != null ? CRUD.getParentDirectory(parsedInputArray[1]) : null;
        let lastPass = parsedInputArray[1] != null ? CRUD.getLastNameFromPass(parsedInputArray[1]) : null;
        if (command == "touch") return CRUD.touch(parentDir, lastPass);
        if (command == "mkDir") return CRUD.mkDir(parentDir, lastPass);
        if (command == "ls") {
            let options = [];
            for (let i=1; i < parsedInputArray.length; i++) {
                const argument = parsedInputArray[i];
                if (argument[0] == "-") {
                    options = argument.split("");
                    options.shift();
                }
                else {
                    parentDir = CRUD.getParentDirectory(parsedInputArray[1]);
                    lastPass = CRUD.getLastNameFromPass(parsedInputArray[1]);
                }
            }
            if (parsedInputArray.length == 1 || options == []) return CRUD.ls(parentDir, lastPass);
            return CRUD.ls(parentDir, lastPass, options);
        }
        if (command == "cd") return CRUD.cd(parentDir, lastPass);
        if (command == "pwd") return CRUD.pwd();
        if (command == "print") return CRUD.print(parentDir, lastPass);
        if (command == "setContent") return CRUD.setContent(parentDir, lastPass, parsedInputArray.slice(2).join(" "));
        if (command == "rm") return CRUD.rm(parentDir, lastPass);
        if (command == "copy") {
            const destinationParentDir = CRUD.getParentDirectory(parsedInputArray[2]);
            const destinationLastPass = CRUD.getLastNameFromPass(parsedInputArray[2]);
            const destinationDir = destinationLastPass != null ? destinationParentDir.children[destinationLastPass] : destinationParentDir;
            return CRUD.copy(parentDir, lastPass, destinationDir);
        }
        if (command == "move") {
            const destinationParentDir = CRUD.getParentDirectory(parsedInputArray[2]);
            const destinationLastPass = CRUD.getLastNameFromPass(parsedInputArray[2]);
            const destinationDir = destinationLastPass != null ? destinationParentDir.children[destinationLastPass] : destinationParentDir;
            return CRUD.move(parentDir, lastPass, destinationDir);
        }
    }
}

class CurrencyConvert {
    static name = "CurrencyConvert";
    static color = "blue";
    static commands = {
        "showAvailableLocales":0,
        "showDenominations":1,
        "convert":3
    };
    static localesAndDenominations = {
        "India":["Rupee", "Paisa"],
        "USA":["Dollar", "USCent"],
        "Europe":["Euro", "EuroCent"],
        "UAE":["Dirham", "Fils"],
    };
    static dominationYenRates = {
        "Rupee": 1.4442,
        "Dollar": 106.1,
        "Euro": 125.56,
        "Dirham": 28.89,
    }

    static setDominationYenRates() {
        CurrencyConvert.dominationYenRates["paisa"] = CurrencyConvert.dominationYenRates.Rupee / 100;
        CurrencyConvert.dominationYenRates["USCent"] = CurrencyConvert.dominationYenRates.Dollar / 100;
        CurrencyConvert.dominationYenRates["EuroCent"] = CurrencyConvert.dominationYenRates.Euro / 100;
        CurrencyConvert.dominationYenRates["Fils"] = CurrencyConvert.dominationYenRates.Dirham / 100;
    }

    // 一般Validator
    static universalValidator(parsedInputArray) {    
        if (parsedInputArray.length < 2) {
            return {'isValid': false, 'pack':CurrencyConvert, 'errorMessage': `Command line input must contain at least 2 elements:<br>'packageName commandName'`};
        }
        if (CurrencyConvert.commands[parsedInputArray[1]] == null) {
            return {'isValid': false, 'pack':CurrencyConvert, 'errorMessage': `CurrencyConvert only supports the following commands:<br>${Object.keys(CurrencyConvert.commands).join(", ")}`};
        }
        return {'isValid': true, 'pack':CurrencyConvert, 'errorMessage': ''}
    }

    // 個別Validator
    static commandArgumentsValidator(parsedInputArray) {
        const commandName = parsedInputArray[1];
        const requiredNumOfArguments = CurrencyConvert.commands[commandName];
        let tailString = `exactly ${requiredNumOfArguments} arguments`;
        if (requiredNumOfArguments == 0) tailString = `no argument`;
        if (requiredNumOfArguments == 1) tailString = `exactly 1 argument`;

        let validate = {'isValid':false, 'pack': CurrencyConvert, 'errorMessage': ''};
        if (parsedInputArray.length - 2 != requiredNumOfArguments) {
            validate.errorMessage = `Command ${commandName} requires ${tailString}.`;
        }

        else if (commandName == "showDenominations" && CurrencyConvert.localesAndDenominations[parsedInputArray[2]] == null) {
            validate.errorMessage = `Command ${commandName} only supports the following locales:<br>${Object.keys(CurrencyConvert.localesAndDenominations).join(", ")}`;
        }

        else if (commandName == "convert" && (CurrencyConvert.dominationYenRates[parsedInputArray[2]] == null || CurrencyConvert.dominationYenRates[parsedInputArray[4]] == null)) {
            validate.errorMessage = `1st and 3rd arguments of command ${commandName} only support the following Denominations:<br>${Object.values(CurrencyConvert.localesAndDenominations).join(", ")}`;
        }
        
        else if (commandName == "convert" && (typeof Number(parsedInputArray[3]) != "number" || isNaN(Number(parsedInputArray[3])))) {
                validate.errorMessage = `2nd argument of command ${commandName} only supports number.`;
        }

        else validate.isValid = true;
        return validate;
    }

    static getResult(parsedInputArray) {
        if (parsedInputArray[1] == "showAvailableLocales")
        {
            const val = Object.keys(CurrencyConvert.localesAndDenominations).join(", ");
            return `Available locales: ${val}`;
        }

        if (parsedInputArray[1] == "showDenominations")
        {
            const key = parsedInputArray[2];
            const val = CurrencyConvert.localesAndDenominations[key].join(", ");
            return `${key} denominations: ${val}`;
        }

        if (parsedInputArray[1] == "convert")
        {
            const sourceDenomination = parsedInputArray[2];
            const sourceAmount = Number(parsedInputArray[3]);
            const destinationDenomination = parsedInputArray[4];
            const yen = CurrencyConvert.dominationYenRates[sourceDenomination] * sourceAmount;
            const val = yen / CurrencyConvert.dominationYenRates[destinationDenomination];
            return `${sourceAmount} ${sourceDenomination} is ${val} ${destinationDenomination}`;
        }
        return "Something went wrong.";
    }
}
CurrencyConvert.setDominationYenRates();


class Library {
    static name = "Library";
    static color = "orange";
    static apiUrl = "https://openlibrary.org/search.json?";
    static commands = {
        "searchByTitle": 2,
        "uniqueNameCount": 1,
        "titlesByUniqueName": 1,
    };

    static universalValidator(parsedInputArray) {
        let validate = {'isValid':false, 'pack': Library, 'errorMessage': ''};
        if (parsedInputArray.length < 3)
        {
            validate.errorMessage = `Command line input must contain at least 3 elements: 'packageName commandName argument(s)'`;
        }
        else if (Library.commands[parsedInputArray[1]] == null)
        {
            validate.errorMessage = `Library only supports the following commands:<br>${Object.keys(Library.commands).join(", ")}`;
        }
        else validate.isValid = true;
        return validate;
    }

    static commandArgumentsValidator(parsedInputArray) {
        let validate = {'isValid':false, 'pack': Library, 'errorMessage': ''};
        const commandName = parsedInputArray[1];
        const requiredNumOfArguments = Library.commands[commandName];
        let tailString = `exactly ${requiredNumOfArguments} arguments`;
        if (requiredNumOfArguments == 1) tailString = `exactly 1 argument`;

        if (commandName == "searchByTitle")
        {
            if (parsedInputArray.length > 4) {
                validate.errorMessage = `Command searchByTitle requires 1 or 2 arguments.`;
            }
            else if (parsedInputArray.length == 4) {
                const n = Number(parsedInputArray[3]);
                if (typeof n != "number" || isNaN(n) || n > 50 || n < 1) {
                    validate.errorMessage = `Command searchByTitle's 2nd argument follows number of 1 ~ 50.`;
                    return validate;
                }
                validate.isValid = true;
            }
            else validate.isValid = true;
        }

        else if (parsedInputArray.length - 2 != requiredNumOfArguments)
        {
            validate.errorMessage = `Command ${commandName} requires ${tailString}.`;
        }

        else validate.isValid = true;
        return validate;
    }

    static async getResult(parsedInputArray) {
        const queryString = Library.getQueryString(parsedInputArray[1], parsedInputArray[2]);
        const responseObj = await Library.getQueryResponseObject(queryString);
        let length = responseObj.docs.length;
        if (parsedInputArray[1] == "searchByTitle" && parsedInputArray[3] != null) length = parsedInputArray[3];

        if (parsedInputArray[1] == "searchByTitle") return `Titles include "${parsedInputArray[2]}":<br>${Library.searchByTitle(responseObj, length)}`;
        if (parsedInputArray[1] == "uniqueNameCount") return Library.uniqueNameCount(responseObj, parsedInputArray[2], length);
        if (parsedInputArray[1] == "titlesByUniqueName") return Library.titlesByUniqueName(responseObj, parsedInputArray[2], length);
        return;
    }

    static searchByTitle(responseObj, length) {
        let val = "";
        for (let i=0; i < length; i++) {
            const obj = responseObj.docs[i];
            const author = obj.author_name;
            const dbKey = obj.key.split("/").slice(-1);
            val += `author: ${author}, key: ${dbKey}<br>`; 
        }
        return val;
    }

    static uniqueNameCount(responseObj, targetName, length) {
        const authorsSet = new Set();
        for (let i=0; i < length; i++) {
            const obj = responseObj.docs[i];
            const authorsList = Library.getAuthorsListFromString(String(obj.author_name));
            for (let j=0; j < authorsList.length; j++) {
                const author = authorsList[j].toLowerCase();
                if (author.includes(targetName.toLowerCase())) authorsSet.add(authorsList[j]);
            }
        }
        const val = Array.from(authorsSet).join(", ");
        return val.length > 0 ? val : "No results found.";
    }

    static titlesByUniqueName(responseObj, targetName, length) {
        const authorsHashMap = {};
        for (let i=0; i < length; i++) {
            const obj = responseObj.docs[i];
            const title = String(obj.title);
            const authorsString = String(obj.author_name);
            const authorsList = Library.getAuthorsListFromString(authorsString);
            for (let j=0; j < authorsList.length; j++) {
                const author = authorsList[j].toLowerCase();
                if (author.includes(targetName.toLowerCase())) {
                    if (authorsHashMap[authorsList[j]] == null) authorsHashMap[authorsList[j]] = [];
                    authorsHashMap[authorsList[j]].push(title);
                }
            }
        }
        let val = "";
        for (const key in authorsHashMap) {
            val += `${key} -> ${authorsHashMap[key].join(", ")}<br>`;
        }
        return val.length > 0 ? val : "No results found.";
    }

    static getAuthorsListFromString(authorsString) {
        const authorsList = [];
        let author = "";
        for (let j=0; j < authorsString.length; j++) {
            const c = authorsString[j];
            if (c == "(") {
                while (authorsString[j] != ")") {
                    author += authorsString[j];
                    j ++;
                }
            }
            if (c == ",") {
                authorsList.push(author);
                author = "";
                j ++;
            }
            author += authorsString[j];
        }
        authorsList.push(author);
        return authorsList;
    }

    static getQueryString (command, argument) {
        let queryString = "";
        if (command == "searchByTitle") {
            queryString = "title=" + argument.toLowerCase();
        }
        else if (command == "uniqueNameCount" || command == "titlesByUniqueName") {
            queryString = "author=" + argument.toLowerCase();
        }
        return queryString;
    }

    static async getQueryResponseObject(queryString) {
        let queryResponseObject = {};
        const queryUrl = Library.apiUrl + queryString;
        await fetch(queryUrl).then(response => response.json()).then(data => queryResponseObject = data);
        return queryResponseObject;
    }
}

class CLI {
    static inputHistories = [];
    static indexCount = 0;
    static currentIndex = 0;
    static root = new Directory("directory", "root", "/");
    static currentDirectory = CLI.root;
    static parameters = {"CurrencyConvert":CurrencyConvert, "Library":Library};
    
    // 入力内容をそのまま出力する
    static echoInputValue(parentDiv) {
        const value = CliInput.value;
        parentDiv.innerHTML += `
            <p class="m-0"><span style='color:purple; font-weight:bold'>${CRUD.pwd(CLI.currentDirectory)}></span> ${value}</p>`;
        CLI.inputHistories.push(value);
        CLI.indexCount ++;
        CLI.currentIndex = CLI.indexCount;
    }

    // 過去の入力データを取得して反映
    static getInputHistories(n) {
        if (CLI.currentIndex + n <= CLI.indexCount-1 && CLI.currentIndex + n >= 0) {
            CLI.currentIndex += n;
            CliInput.value = CLI.inputHistories[CLI.currentIndex];
        }
    }

    // 入力String　をArray に変換して取得
    static commandLineParser(inputValue) {
        return inputValue.trim().split(" ");
    }

    // 総合Validator
    static parsedArrayValidator(parsedInputArray) {
        let validatorResponse = CLI.parameter0Validator(parsedInputArray);
        if (!validatorResponse['isValid']) return validatorResponse;

        if (validatorResponse["pack"] != CRUD) {
            validatorResponse = validatorResponse["pack"].universalValidator(parsedInputArray);
            if (!validatorResponse['isValid']) return validatorResponse;
        }

        validatorResponse = validatorResponse["pack"].commandArgumentsValidator(parsedInputArray);
        if (!validatorResponse['isValid']) return validatorResponse;
        return {'isValid': true, 'pack': validatorResponse["pack"], 'errorMessage': ''};
    }

    // Validator. package が正しいか判定
    static parameter0Validator(parsedInputArray) {
        const array0 = parsedInputArray[0];
        if (CLI.parameters[array0] != null) return {"isValid": true, "pack": CLI.parameters[array0], 'errorMessage': ''};
        if (CRUD.commands[array0] != null) return {"isValid": true, "pack": CRUD, 'errorMessage': ''};
        return {"isValid": false, "pack": null, 'errorMessage': `"${array0}" is not valid command or package name. This CLI only supports the following commands and packages:<br>Comands: ${Object.keys(CRUD.commands).join(", ")}<br>Packages: ${Object.keys(CLI.parameters).join(", ")}`};
    }

    // CLI出力
    static appendResultParagraph(container, isValid, pack, message) {
        let name = "";
        let color = "";

        if (isValid) {
            if (pack == CRUD) name = CRUD.pwd(CLI.currentDirectory);
            else name = pack.name;
            color = pack.color;
        }
        else {
            if (pack == null || pack == CRUD) name = "Error";
            else name = `${pack.name}Error`;
            color = "red";
        }

        container.innerHTML+=
            `<p class="m-0" style="font-weight:bold">
                <span style='color: ${color}'>${name}></span> ${message}
            </p>`;
        return;
    }
}