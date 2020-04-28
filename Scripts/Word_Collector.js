const FS = require("fs");

const axios   = require('axios').default;
const cheerio = require('cheerio');

var $log = console.log;

//-URL---------------------------------------------------
const dictionaryURL = 'https://www.dictionary.com/browse/';
const firstWord = 'aardvark';
const lastWord  = 'zyzzyva';


//-Files-------------------
let DIRECTORY = './Words/';
let readFile  = '';
let writeFile = '';

//-State Machine------------
class StateMachine {
    constructor()
    {
        this.State = 'SETUP';
        this.Loop  = 0;
    }
    Set = (_state) => { this.State = _state.toUpperCase(); }
    Is  = (_state) => { if(this.State==_state) return true; return false; }
}
var STATE = new StateMachine();

//-Word as checkable entry----
class WORD {
    constructor(_word)
    {
        this.Word   = _word;
        this.Checked= false;
        this.Valid  = false;
        this.Msg    = '';
    }
    IsValid = (_msg) => 
    { 
        this.Checked=true; this.Valid=true; 
        this.Msg = _msg; 
    }
    Invalid = (_msg) =>
    {
        this.Checked=true;
        this.Msg = _msg;
    }
}
var ACTIVE_WORD = '';


/**
 * ---------- MAIN LOOP ---------- *
 */                                
let mainLoop = setInterval( () =>
{

    if( STATE.Is("SETUP") || STATE.Is("GET_WORD") )
    {
        STATE.Set("PROCESSING");
        //
        Load_Word().then( (word) =>
        {
            
            ACTIVE_WORD = word;
            STATE.Set("CHECK_WORD");
            // DEBUG
            STATE.Loop++;
            $log(`State Loop::${STATE.Loop}`);
        });
    }
    if( STATE.Is("CHECK_WORD") )
    {
        STATE.Set("PROCESSING");
        //
        Check_Word().then( (wordHTML) => 
        {
            Parse_Word(wordHTML).then( (wordList) => 
            {
                Save_WordList(wordList).then( ()=>
                {
                    if( STATE.Loop==50000 ) STATE.Set("FINISHED");
                    else
                        STATE.Set("GET_WORD"); // <-- Change to Reset!
                })
            });

        }).catch( (error)=>
        {
            //*Should be the ACTIVE_WORD as an error!
            $log('Check word ERROR::')
            $log(error)
            
            //-Axios processing error...typically bad, and cause for termination!
            if( typeof(error)=='string' ) {
                if( error.includes('!Hard Reject!') ) 
                {
                    clearInterval(mainLoop)
                    return;
                }}
            
            //-Save word as erroneous
            Save_WordList(error).then( ()=>
            {
                STATE.Set("GET_WORD"); // <-- Change to Reset!
            });

        })
    }

    if( STATE.Is("FINISHED") )
    {
        clearInterval(mainLoop)
    }



}, 500);


/**
 * Load the next available word to check!
 */
function Load_Word ()
{
    return new Promise( (resolve, reject) =>
    {
    ACTIVE_WORD = null;

    // ACTIVE_WORD = Get_First_Word();
    // resolve( ACTIVE_WORD );
    // return;

    //Check Directory
    let files = [];
    let directory = FS.readdirSync(DIRECTORY);
    directory.forEach((e) => {
        //if(e.includes('chunk_')) cFile=e;
        if( e.includes('.json') ) files.push( e.toString() )
    });

    $log(`JSON Word Files::${files}`);

    //-If no file found...
    if( !files.length ) ACTIVE_WORD = Get_First_Word();

    //-Go through files until we find a word that hasn't been checked!
    for(let i=0; i<files.length; i++)
    {
        let fileData = FS.readFileSync( DIRECTORY+files[i] );
        let wordData = JSON.parse( fileData );

        //-Iterate through words
        for(let j=0; j<wordData.length; j++)
        {
            if( wordData[j].Checked==false ) 
            {
                ACTIVE_WORD = new WORD( wordData[j].Word );
                break;
            }
        }

        // Return if we have a word
        if( ACTIVE_WORD!=null ) break;
    }

    // DEBUG
    $log(`Get Word::${ACTIVE_WORD.Word}`);

    resolve( ACTIVE_WORD );
    return;
    });
}

/**
 * Scrape from Dictionary.com
 */
function Check_Word () 
{
    return new Promise( (resolve, reject) =>
    {
        // Build our URL
        let word = URL_Formatted_Word( ACTIVE_WORD.Word );
        //let word = 'wooop' //<--TEST
        let url = dictionaryURL + word;
        $log(`Axios URL::${url}`);

        //-Create an instance with a longer timeout...
        const myAxios = axios.create(
            {
                timeout : 10000
            });


        // Web Request...
        myAxios.get( url ).then( (response) => 
        {
            //-If successful: Cheerio the result into HTML and return
            const $ = cheerio.load( response.data );
            resolve($.html());
            return;

        }).catch( (error) =>
        {

            //-Catch no-internet/site address error
            if( error.errno!=undefined ) 
            {
                reject(`!Hard Reject!::Axios error - ${error}`);
                return;
            }
            else
            {
                $log(`Axios - ${error}`);
                //console.table(error)
                //
                ACTIVE_WORD.Invalid("Word doesn't exist");
                reject(ACTIVE_WORD)
                return;
            }
        });

    });
}

function Parse_Word (wordHTML)
{
    return new Promise( (resolve, reject) => 
    {
    const $ = cheerio.load(wordHTML);

    let wordList = [];

    //-FOUND
    let headWord_text = $('.entry-headword h1').text()
    if( headWord_text!=null )
    {
        $log(`Headword Found--${headWord_text}!`);
        ACTIVE_WORD.IsValid(headWord_text);

        $log(`Elements::${ $('h2').length } `)

        //-Pull Nearby Words
        if ( $('h2').length ) 
        {
            $('h2').each((i, e) => 
            {
                let Section = $(e).text();

                $log(i + ' - ' + Section)

                if (Section.startsWith('Words nearby ')) {
                    let words = $(e).next().text().split(',');
                    for (let x = 0; x < words.length; x++) 
                    {
                        let w = words[x].trim();
                        words[x] = new WORD( w );
                        wordList.push( words[x] )
                    }
                }

                if( Section.startsWith('Words related to '))
                {
                    //-Grab and format related words!
                    let words = $(e).next().text().split(',');
                    
                    for (let x = 0; x < words.length; x++) 
                    {
                        let w = words[x].trim();
                        words[x] = new WORD( w );
                        wordList.push( words[x] );
                    }
                }
            });

            //-if the ACTIVE_WORD exists, overwrite it
            let activeWord_index = wordList.findIndex( (e) => {return e.Word==ACTIVE_WORD.Word} ); 
            wordList[activeWord_index] = ACTIVE_WORD;
            //
            if( activeWord_index < 0 )
                wordList.push( ACTIVE_WORD );

        }
        else
        {
            wordList.push(ACTIVE_WORD);
        }
    }

        //$log('Word List');
        //$log(wordList);
        resolve( wordList );

    });
}

/**
 * Parse the 'Words Nearby' section on Dictionary.com
 */
function Save_WordList(wordList) {
    return new Promise((resolve, reject) => 
    {
        $log('Saving wordlist...');

        //-Turn singular object into an array
        if (wordList.length == undefined) wordList = new Array(wordList);

        for (let i = 0; i < wordList.length; i++) 
        {
            //-Derive word file from the word's initial letter!
            let wordFile = (wordList[i].Word[0].toUpperCase()) + '.json';
            wordFile = DIRECTORY + wordFile;

            //-Check if file exists
            let fileExists = FS.existsSync(wordFile);


            if (fileExists) {
                let fileContent = FS.readFileSync(wordFile);
                fileContent = JSON.parse(fileContent);

                //-Replace existing words (prevents duplicates!)
                let _wordIndex = fileContent.findIndex((e) => { return e.Word == wordList[i].Word });
                if (_wordIndex != -1) {
                    //-If the word's has NOT been checked...add
                    if ( fileContent[_wordIndex].Checked==false )
                    {
                        fileContent[_wordIndex] = wordList[i];
                    }
                }
                else {
                    fileContent.push(wordList[i]);
                }

                fileContent = JSON.stringify(fileContent);
                //
                FS.writeFileSync(wordFile, fileContent);
            }
            else {
                let fileContent = [];
                fileContent.push(wordList[i]);
                fileContent = JSON.stringify(fileContent);
                //
                FS.writeFileSync(wordFile, fileContent);
                // LOG
                $log(`New word file written::${wordFile} !`);
            }
        }
        resolve();
        return;
    });


}

/**
 * 
 * @param {*} _rawWord 
 */
function URL_Formatted_Word(_rawWord)
{
    //-Format each non-character into a '-' so the word 
    // is accepted in a URL
    let word = _rawWord.replace(/[^a-zA-Z]/g, "-");
    return word;
}

/**
 * Assign the first word to begin!
 */
function Get_First_Word () 
{
    ACTIVE_WORD = new WORD(firstWord);
    return ACTIVE_WORD;
}