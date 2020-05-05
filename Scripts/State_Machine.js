

exports.State_Machine = class 
{
    constructor ()
    {
        this.State = '';
        this.Loop  = 0;
        //
        this.Debug = false;
        this.FinishState = "FINISHED";
    }
    Is = (_state) => 
    { 
        if(this.State==_state) return true; return false; 
    }
    Set = (_state) => 
    { 
        this.State = _state; 
        // DEBUG
        console.log(`State-Machine. State updated to::${this.State}`);
    }
    /**Convenience method */
    Process = () => { this.State="PROCESSING"; }
    /**Convenience method to finish */
    Finish = () => { this.State=this.FinishState; }
    IS_FINISHED = () => { if(this.State==this.FinishState) return true; return false; }

}

/**
 * BONUS: Debugging controller - Turns groups of debugging messages on and off!
 */
exports.DebugController = class {
    constructor()
    {
        this.Definitions = false;
        this.Word_Forms  = false;
        this.Def_Table   = false;
        this.Def_Examples= false;
        this.Synonyms    = false;
        this.Antonyms    = false;
        this.Syn_Examples= false;
    }
    Turn_All_On = (_OBJ) => 
    {
        let keys = Object.keys(_OBJ);
        for(let i=0; i<keys.length; i++) {
            let key = keys[i].toString();
            _OBJ[key] = true;
        }
    }
}