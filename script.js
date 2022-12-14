var ActionsEnum;
(function (ActionsEnum) {
    ActionsEnum["PLAY"] = "p";
    ActionsEnum["STOP"] = "s";
    ActionsEnum["IDLE"] = "i";
    ActionsEnum["FUNCTION"] = "f";
    ActionsEnum["DELAY"] = "d";
})(ActionsEnum || (ActionsEnum = {}));
;
var ActionDef = /** @class */ (function () {
    function ActionDef(action, args) {
        this.action = action;
        this.args = args;
    }
    return ActionDef;
}());
var MusicSequence = /** @class */ (function () {
    function MusicSequence(trackid, actions) {
        this.trackid = trackid;
        this.actions = actions;
    }
    return MusicSequence;
}());
var Mapper = /** @class */ (function () {
    function Mapper() {
    }
    Mapper.parseAction = function (str) {
        var kStart = str.indexOf('~');
        var kStop = str.substring(++kStart).indexOf('~');
        str = str.substring(kStart, ++kStop);
        var action = str[0];
        return new ActionDef(action, str.substring(1));
    };
    Mapper.parseActions = function (str) {
        var actions = [];
        str = str.substring(str.indexOf("~"));
        while (str != "~`" && str.length > 2) {
            actions.push(this.parseAction(str));
            str = str.substring(1);
            str = str.substring(str.indexOf("~"));
        }
        return actions;
    };
    Mapper.parseSequence = function (str) {
        return str != "null" ? new MusicSequence(str[0], this.parseActions(str)) : new MusicSequence(null, []);
    };
    Mapper.serializeActions = function (actions, noNewLine) {
        var str = "";
        for (let i = 0; i < actions.length; i++) {
            str += "~";
            str += actions[i].action;
            str += actions[i].args;
        }
        str += (noNewLine === true) ? "~" : "~`";
        return str;
    };
    Mapper.serializeSequence = function (sequence) {
        let str = "";
        str += sequence.trackid;
        str += this.serializeActions(sequence.actions);
        return str;
    };
    return Mapper;
}());

let idCount = 1, invalidateCount = 0;
document.addEventListener('DOMContentLoaded', function () {
});

var port, writer = null;

function addAction(){
    const sequenceEdit = document.querySelector('#seq-e0');
    let seqWrap = document.querySelector('#seqwrap');
    const clone = sequenceEdit.cloneNode(true);
    clone.id = 'seq-e' + idCount++;
    clone.firstChild.nodeValue = '';
    clone.querySelector('input').value = '';
    clone.querySelector('button').addEventListener('click', () => {
        seqWrap.removeChild(clone);
    });
    seqWrap.appendChild(clone);
}

function deleteSequence(){
    const sequenceEdit = document.querySelector('#seq-e0');
    let seqWrap = document.querySelector('#seqwrap');
    const clone = sequenceEdit.cloneNode(true);

    for(let i = 0; seqWrap.hasChildNodes(); i++){
        seqWrap.removeChild(seqWrap.lastChild);
    }

    idCount = 0;
    clone.id = 'seq-e' + idCount++;
    clone.firstChild.nodeValue = '';
    clone.querySelector('input').value = '';
    seqWrap.appendChild(clone);
}

async function saveSequence(){
    const trackid = document.querySelector('#track-id').value;
    let sequence = new MusicSequence(trackid, []);

    const seqWrap = document.querySelector('#seqwrap');
    const actDefs = seqWrap.children;
    for(let i = 0; i < actDefs.length; i++){
        const action = actDefs[i].querySelector('select').value == "none" ? "" : actDefs[i].querySelector('select').value;
        const args = actDefs[i].querySelector('input').value;
        if(action != '' && args != '') sequence.actions.push(new ActionDef(action, args));
    }
    let sequenceStr = "s";
    sequenceStr += Mapper.serializeSequence(sequence);
    sequenceStr += "\r\n";
    writeToSerial(sequenceStr);
}

function stageChange(){
    deleteSequence();
    const trackid = document.querySelector('#track-id').value;
    writeToSerial(`g${trackid}`);
}

function buildSequenceDOM(sequenceStr){
    deleteSequence();
    const sequence = Mapper.parseSequence(sequenceStr);
    let sequenceEdit = document.querySelector('#seq-e0');
    const seqWrap = document.querySelector('#seqwrap');
    const actDefs = seqWrap.children;

    if(sequence.actions.length > 0){
        sequenceEdit.querySelector('select').value = sequence.actions[0].action;
        sequenceEdit.querySelector('input').value = sequence.actions[0].args;
    }

    for(let i = 1; i < sequence.actions.length; i++){
        const clone = sequenceEdit.cloneNode(true);
        clone.id = 'seq-e' + idCount++;
        clone.querySelector('select').value = sequence.actions[i].action;
        clone.querySelector('input').value = sequence.actions[i].args;
        clone.querySelector('button').addEventListener('click', () => {
            seqWrap.removeChild(clone);
        });
        seqWrap.appendChild(clone);
    }
}

function validateSequenceStr(sequenceStr){
    return /^\d~(.*)~`$/.test(sequenceStr) | sequenceStr == "null";
}

function writeToSerial(data){
    if(writer == null){
        alert("Port not selected!!");
        return;
    }
    writer.write(data);
}

async function connectToSerial(){
    if("serial" in navigator){
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 76800 });

        const textEncoder = new TextEncoderStream();
        writer = textEncoder.writable.getWriter();
        const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);

        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();

        await port.setSignals({ dataTerminalReady: true });
        await port.setSignals({ requestToSend: true });

        while (port.readable) {
            try {
                sequenceStr = "";
            while (true) {
                const { value, done } = await reader.read();
                if (value) {
                sequenceStr += value;
                setTimeout(()=>{sequenceStr = ""}, 1000);
                }
                if (done) {
                    reader.releaseLock();
                    break;
                }
                if(validateSequenceStr(sequenceStr)){
                    buildSequenceDOM(sequenceStr);
                    sequenceStr = "";
                    invalidateCount = 0;
                }
            }
            } catch (error) {
            }
        }
    }
    else {
        alert("Your browser doesn't support Web Serial API");
    }
    
}
