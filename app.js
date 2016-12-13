Array.prototype.inArray = function(x){
    for(var i=0,l=this.length;i<l;i++)
        if(this[i] == x) return true;
    return false;
};

window.onload = function(){
    app.init();
};

var app = {
    // algorithm
    T: [],
    iToriginalLength: 0,
    iM: 1,
    iTroot: 0,
    aReadyTasks: [],
    Lmax:  0,
    iLmax: 0,

    // graphics
    cnv:     false,
    cnvTree: false,
    cnvWIDTH:  0,
    cnvHEIGHT: 0,
    cnvFRAME: 20,
    cnvUP:   150,
    maxWidth:  0,
    scale: 1,
    log: "",
    buf: "",

    // config
    displayLog: true,
    displayColors: false,
    bOneLine: false,
    bRandomTasks: false,
    bCanvasTextEnabled: false,
    sAlgorithm: "",

    init: function(){
        app.cnv = document.getElementById("cnvsChart");
        app.cnvWIDTH  = parseInt(app.cnv.width);
        app.cnvHEIGHT = parseInt(app.cnv.height);
        app.ctx = app.cnv.getContext("2d");
        CanvasTextFunctions.enable(app.ctx);

        app.log = document.getElementById("log");

        app.start();
        showInfo();
    },

    start: function(){
        document.getElementById("inpG").disabled = true;

        // clear Tasks and content, check settings...
        app.T = [];
        app.aReadyTasks = [];
        clearLog();
        checkOneLine();
        checkRandomTasks();
        checkAlgType();

        app.generateTasks();

        switch(app.sAlgorithm){
            case "1||Lmax":
                logh("Generated tasks:");
                app.showAllTasks("p,r,d");

                logbr();

                logh("Arrange tasks in EDD order");
                app.T.sort(sortEDD);
                app.showAllTasks("p,r,d");
                app.scheduler1();

                logbr();

                logh("Scheduled tasks:");
                app.calculateLatenesses();
                app.showAllTasks("p,r,d,s,c,L");
            break;

            case "1|rj,prm|Lmax":
                logh("Generated tasks:");
                app.showAllTasks("p,r,d");

                logbr();

                logh("Arrange tasks in EDD order");
                app.T.sort(sortEDD);
                app.showAllTasks("p,r,d");

                logbr();

                logh("Schedule tasks (Liu algorithm)");
                app.scheduler2();

                logbr();

                logh("<br>Scheduled tasks:");
                app.calculateLatenesses();
                app.showAllTasks("p,r,d,s,c,L");
            break;

            case "1|rj,prm,prec|Lmax":
                logh("Generated tasks:");
                app.showAllTasks("p,r,d,prec,waiting");

                logbr();

                logh("Calculate d* and arrange tasks in EDD dprec order");
                app.setdprec3();
                app.T.sort(sortEDDdprec);
                app.showAllTasks("p,r,d,d*,prec,waiting");

                logbr();

                logh("Schedule tasks (modified Liu algorithm O(n^2))");
                app.scheduler3();

                logbr();

                logh("Scheduled tasks:");
                app.calculateLatenesses();
                app.showAllTasks("p,r,d,d*,s,c,prec,L");
            break;

            case "P|pj=1,in-tree|Lmax":
                logh("Generated tasks:");
                app.showAllTasks("d,prec,next");

                logbr();

                logh("Schedule tasks (Brucker's algorithm O(nlog n))");
                log1("set d*");
                var Troot = app.T[app.getRealIndex(app.iTroot)];
                Troot.dprec = 1 - Troot.d;
                log2("for root T["+Troot.i+"]: d* = {1-d} = "+Troot.dprec);
                log2("for other tasks: d* = max{1+d*next, 1-d}:");
                app.setdprec4(Troot,Troot.dprec);

                app.scheduler4();

                logbr();

                logh("Scheduled tasks:");
                app.calculateLatenesses();
                app.showAllTasks("p,s,c,d,d*,M,L");
            break;
        }

        app.drawChart();
        outputLog();

        document.getElementById("inpG").disabled = false;
    },

    generateTasks: function(){
        var n = parseInt(document.getElementById("inpTnum").value);

        if(app.bRandomTasks){
            var pmin,pmax,rmin,rmax,dmin,dmax;
            var pRand,rRand,dRand;
            pmin = parseInt(document.getElementById("inpPmin").value);
            pmax = parseInt(document.getElementById("inpPmax").value);
            rmin = parseInt(document.getElementById("inpRmin").value);
            rmax = parseInt(document.getElementById("inpRmax").value);
            dmin = parseInt(document.getElementById("inpDmin").value);
            dmax = parseInt(document.getElementById("inpDmax").value);

            for(var i=1;i<=n;i++){
                pRand = Math.floor(Math.random()*(pmax-pmin+1))+pmin;
                rRand = Math.floor(Math.random()*(rmax-rmin+1))+rmin;
                dRand = Math.floor(Math.random()*(dmax-dmin+1))+rRand+pRand;
                app.T.push(new Task(pRand,rRand,Math.floor(5*dRand/3),i));
            }
        } else {
            // TODO: dodac reczne wprowadzanie danych (HTML table + inputy + JS)
            alert("random tasks only");
        }
        app.iToriginalLength = app.T.length;

        // jesli zadania sa zalezne, wylosuj zaleznosci:
        if("1|rj,prm,prec|Lmax" == app.sAlgorithm){
            for(var i=0;i<app.T.length;i++) // dla kazdego zadania i
                for(var k=i+1;k<app.T.length;k++) // tylko sposrod kolejnych zadan k
                    if(Math.random()<0.5) // wylosuj, czy uzaleznic zadanie i od zadania k
                        app.T[i].prec.push(app.T[k].i);

            // uzupelnij tablice waiting kazdego zadania
            for(var i=0,ii=app.T.length;i<ii;i++) // dla kazdego zadania
                for(var j=0;j<ii;j++) // sprawdz wszystkie pozostale
                    if(j!=i && app.T[j].prec.inArray(app.T[i].i)) // jesli oczekuja
                        app.T[i].waiting.push(app.T[j].i); // dodaj ich numer
        }

        // jesli in-tree, wylosuj kolejnosc
        if("P|pj=1,in-tree|Lmax" == app.sAlgorithm){
            var t,s;
            app.iM = parseInt(document.getElementById("inpMnum").value);

            var aTempT = [];
            var aTempS = [];

            for(var i=1;i<=app.iToriginalLength;i++) aTempT.push(i);

            app.iTroot= aTempT.splice(Math.floor(Math.random()*aTempT.length),1);

            app.T[app.getRealIndex(app.iTroot)].iNext = false;
            aTempS.push(app.iTroot);
            while(aTempT.length > 0){
                t = parseInt(aTempT.splice(Math.floor(Math.random()*aTempT.length),1));
                s = parseInt(aTempS[Math.floor(Math.random()*aTempS.length)]);
                aTempS.push(t);
                app.T[app.getRealIndex(s)].prec.push(t);
                app.T[app.getRealIndex(t)].iNext = s;
            }
        }
    },

    /********************************************************
     *  1||Lmax
     ********************************************************/
    scheduler1: function(){
        var t = 0;
        for(var i=0,ii=app.T.length;i<ii;i++){
            app.T[i].s = t;
            app.T[i].c = t + app.T[i].p;
            t = t + app.T[i].p;
        }
    },

    /********************************************************
     *  1|rj,prm|Lmax
     ********************************************************/
    scheduler2: function(T,t){
        T = T || app.getFirstRemainingTask2(0);
        t = t || 0;

        log1("checking Task["+T.i+"] at t="+t);
        if(t < T.r){
            log2("Task["+T.i+"] delayed by r="+T.r);
            t = T.r;
        }
        T.s = t;
        var Tnext = app.getInterruptingTask2(T,t);
        // jesli nie zostanie przerwane przez nastepne zadanie, to skoncz T
        if(false === Tnext){
            //log2("Task["+T.i+"] not interrupted");
            t = t + T.p;
            T.c = t;
            T.done = true;
            log2("Task["+T.i+"] completed at t="+t);
            Tnext = app.getFirstRemainingTask2(t);
            if(Tnext) app.scheduler2(Tnext,t);
            else log1("all tasks completed");
        } else {
            // jesli zadanie ma zostac przerwane ustawiam czas na przerwanie
            log2("Task["+T.i+"] interrupted by Task["+Tnext.i+"]");
            t = Tnext.r;

            // rozdziel zadanie T i zakoncz pierwsza czesc
            // log2("Task["+T.i+"] divided");
            var Tnew = new Task(T.p,T.r,T.d,T.i);
            T.c = t;
            T.p = T.c - T.s;
            Tnew.p = Tnew.p - T.p;
            T.done = true;
            log2("Task["+T.i+"] partially completed at t="+t);
            app.T.push(Tnew);
            app.T.sort(sortEDD);

            // process next task
            app.scheduler2(Tnext,t);
        }
    },

    getInterruptingTask2: function(T,t){
        for(var i=0,ii=app.T.length;i<ii;i++){
            if(!app.T[i].done){
                if((t < app.T[i].r) && (app.T[i].r < T.s+T.p) && (app.T[i].d < T.d)){
                    return app.T[i];
                }
            }
        }
        return false;
    },

    getFirstRemainingTask2: function(t){
        var iFirstFreeR = 0;
        var bIsFreeR = false;
        var Tfirst = app.T[0];
        for(var i=0,ii=app.T.length;i<ii;i++){
            if(!app.T[i].done){
                // zapamietaj pierwsze zadanie z relase time wiekszym niz teraz
                if(!bIsFreeR) if(t < app.T[i].r){iFirstFreeR = i; bIsFreeR = true;}
                // jesli sie da, to odpal pierwsze mozliwe wg. d
                if(app.T[i].r <= t){
                    // log2("first remaining Task["+app.T[i].i+"]");
                    return app.T[i];
                } else if(app.T[i].r < Tfirst.r) {
                    Tfirst = app.T[i];
                }
            }
        }
        // jesli brak zadan do wykonania
        if(Tfirst.done === true){
            if(bIsFreeR) return app.T[iFirstFreeR];
            // log2("no remaining tasks");
            return false;
        } else {
            // log2("first remaining Task["+Tfirst.i+"], delayed r="+Tfirst.r);
            return Tfirst;
        }
    },

    /********************************************************
     *  1|rj,prm,prec|Lmax
     ********************************************************/
    setdprec3: function(){
        var dprec = 0;

        // dla kazdego zadania i
        for(var i=0,ii=app.T.length;i<ii;i++){
            dprec = app.T[i].d;
            // przypisz wartosc najmniejsza di sposrod zadan na nie oczekujacych
            for(var j=0,jj=app.T[i].waiting.length; j<jj; j++)
                dprec = Math.min(dprec,app.T[app.getRealIndex(app.T[i].waiting[j])].d);
            app.T[i].dprec = dprec;
        }
    },

    scheduler3: function(T,t){
        T = T || app.getFirstRemainingTask3(0);
        t = t || 0;

        log1("checking Task["+T.i+"] at t="+t);
        if(t < T.r){
            log2("Task["+T.i+"] delayed by r="+T.r);
            t = T.r;
        }
        T.s = t;
        var Tnext = app.getInterruptingTask3(T,t);
        // jesli nie zostanie przerwane przez nastepne zadanie, to skoncz T
        if(false === Tnext){
            //log2("Task["+T.i+"] not interrupted");
            t = t + T.p;
            T.c = t;
            T.done = true;
            log2("Task["+T.i+"] completed at t="+t);
            Tnext = app.getFirstRemainingTask3(t);
            if(Tnext) app.scheduler3(Tnext,t);
            else log1("all tasks completed");
        } else {
            // jesli zadanie ma zostac przerwane ustawiam czas na przerwanie
            log2("Task["+T.i+"] interrupted by Task["+Tnext.i+"]");
            t = Tnext.r;

            // rozdziel zadanie T i zakoncz pierwsza czesc
            // log2("Task["+T.i+"] divided");
            var Tnew = new Task(T.p,T.r,T.d,T.i);
            T.c = t;
            T.p = T.c - T.s;
            Tnew.p = Tnew.p - T.p;
            Tnew.dprec = T.dprec;
            Tnew.prec = T.prec;
            T.done = true;
            log2("Task["+T.i+"] partially completed at t="+t);
            app.T.push(Tnew);
            app.T.sort(sortEDDdprec);

            // zacznij przetwarzac nastepne
            app.scheduler3(Tnext,t);
        }
    },

    getInterruptingTask3: function(T,t){
        for(var i=0,ii=app.T.length;i<ii;i++){
            if(!app.T[i].done){
                if((t < app.T[i].r) && (app.T[i].r < T.s+T.p) && (app.T[i].dprec < T.dprec)){
                    if(app.T[i].isReady()){
                        // log2("interrupting Task["+app.T[i].i+"]");
                        return app.T[i];
                    } else {
                        log2("interrupting Task["+app.T[i].i+"] not ready yet");
                    }
                }
            }
        }
        //log2("no interruptting tasks");
        return false;
    },

    getFirstRemainingTask3: function(t){
        var iFirstFreeR = 0;
        var bIsFreeR = false;
        var Tfirst = app.T[0];
        for(var i=0,ii=app.T.length;i<ii;i++){
            if(!app.T[i].done && app.T[i].isReady()){
                // zapamietaj pierwsze zadanie z relase time wiekszym niz teraz
                if(!bIsFreeR) if(t < app.T[i].r){iFirstFreeR = i; bIsFreeR = true; Tfirst = app.T[iFirstFreeR];}
                // jesli sie da, to odpal pierwsze mozliwe wg. d
                if(app.T[i].r <= t){
                    //log2("first remaining Task["+app.T[i].i+"]");
                    return app.T[i];
                } else if(app.T[i].r < Tfirst.r) {
                    Tfirst = app.T[i];
                }
            }
        }
        // jesli brak zadan do wykonania
        if(Tfirst.done === true){
            if(bIsFreeR) return app.T[iFirstFreeR];
            // log2("no remaining tasks");
            return false;
        } else {
            // log2("first remaining Task["+Tfirst.i+"], delayed r="+Tfirst.r);
            return Tfirst;
        }
    },

    /********************************************************
     *  P|pj=1,in-tree|Lmax
     ********************************************************/
    setdprec4: function(T,dprecNext){
        var Tprev;
        for(var i=0,ii=T.prec.length;i<ii;i++){
            Tprev = app.T[app.getRealIndex(T.prec[i])];
            Tprev.dprec = Math.max(1+dprecNext,1-Tprev.d);
            log2("T["+T.i+"].d*next="+dprecNext+" \tT["+Tprev.i+"].d*="+Tprev.dprec);
            app.setdprec4(Tprev,Tprev.dprec);
        }

        // dodaj go do gotowych, jesli go tam jeszcze nie ma
        if(0 === T.prec.length){
            var bIsInReady = false;
            for(var i=0,ii=app.aReadyTasks;i<ii;i++){
                if(app.aReadyTasks[i] == T.i) bIsInReady = true;
            }
            if(!bIsInReady){
                app.aReadyTasks.push(T.i);
                log("\t\t\t"+"T["+T.i+"] is ready");
            }
        }
    },

    scheduler4: function(t){
        t = t || 0;
        log1("checking tasks at t="+t);
        app.aReadyTasks.sort(sortdprec);
        log2("ready tasks sorted: "+app.aReadyTasks);

        // wez M pierwszych wolnych i obrob
        var iToGet = (app.iM < app.aReadyTasks.length) ? app.iM : app.aReadyTasks.length;
        var aToProcessing = [];
        var bContinue = true;
        var i=0,j=0;
        while(bContinue && (i<iToGet)){
            // if task is ready move it to ready queue
            if(app.T[app.getRealIndex(app.aReadyTasks[j])].isReady()){
                aToProcessing.push(app.aReadyTasks.splice(j,1));
                j--; i++;
            }
            j++;
            if(app.aReadyTasks.length == j) bContinue = false;
        }

        var T,iIndexToProcessing;
        for(i=0,ii=aToProcessing.length;i<ii;i++){
            iIndexToProcessing = app.getRealIndex(aToProcessing[i]);
            T = app.T[iIndexToProcessing];
            T.s = t;
            T.c = T.s+T.p;
            T.M = i;
            T.done = true;
            log2("T["+T.i+"] completed on M["+i+"]");
            if(T.iNext === false){
                log1("all tasks completed");
            } else {
                // if possible add next tasks to ready queue
                var bReady = true;
                var Tnext = app.T[app.getRealIndex(T.iNext)];
                for(var j=0,jj=Tnext.prec.length;j<jj;j++){
                    bReady = (bReady && app.T[app.getRealIndex(Tnext.prec[j])].done) ? true : false;
                }
                if(bReady){
                    app.aReadyTasks.push(T.iNext);
                    log2("T["+T.iNext+"] ready");
                }
            }
        }
        if(app.aReadyTasks.length > 0) {
            // to mozna rozbudowac o dla p > 1
            // zeby pobieralo dane o stanie gotowosci Maszyny i zmienic ponizsze t+1
            app.scheduler4(t+1);
        }
    },
 /*******************************************************/

    calculateLatenesses: function(){
        for(var i=0,ii=app.T.length;i<ii;i++){
            app.T[i].calculateLateness();
            if(app.T[i].L > app.Lmax){
                app.Lmax = app.T[i].L;
                app.iLmax = app.T[i].i;
            }
        }
    },

    showAllTasks: function(sInfo){
        for(var i=0,ii=app.T.length;i<ii;i++){
            app.T[i].info(sInfo);
        }
    },

    getColor: function(i){
        var r,g,b,iColor;
        iColor = Math.floor(200*app.T[i].i/app.iToriginalLength+55);

        if(app.displayColors){
            g = 255 - iColor;
            r = 0 + Math.floor(iColor / 2);
        } else {
            r = 0;
            g = iColor;
        }
        b = 0;

        return [r,g,b];
    },

    drawChart: function(){
        // clear previous content
        app.ctx.clearRect(0,0,app.cnvWIDTH,app.cnvHEIGHT);
        // scale...
        app.maxWidth = 0;
        app.scale = 1;
        for(var i=0,ii=app.T.length;i<ii;i++){
            if(app.T[i].c > app.maxWidth) app.maxWidth = app.T[i].c;
            if(app.T[i].d > app.maxWidth) app.maxWidth = app.T[i].d;
        }
        app.scale = (app.cnvWIDTH-2*app.cnvFRAME)/app.maxWidth;

        // draw XOY
        drawXOY();
        drawScale();

        // draw all tasks
        var bSplitted,aRGB;
        var iMax = [];
        for(var i=0,ii=app.T.length;i<ii;i++){
            iMax[i] = true;
            for(var j=0;j<ii;j++)
              if((app.T[i].i == app.T[j].i) && (app.T[i].c < app.T[j].c)){
                  iMax[i] = false;
              }
        }
        for(var i=0,ii=app.T.length;i<ii;i++){
            aRGB = app.getColor(i);
            app.T[i].drawTask(aRGB[0],aRGB[1],aRGB[2],iMax[i]);
            app.T[i].drawDeadlineMark(aRGB[0],aRGB[1],aRGB[2]);
        }

        if("P|pj=1,in-tree|Lmax"== app.sAlgorithm)
            app.drawChartTree();
    },

    drawChartTree: function(){
        var Troot = app.T[app.getRealIndex(app.iTroot)];
        app.drawLeaf(Troot,app.cnvWIDTH-app.cnvFRAME-10,120,0,0,1);
    },

    drawLeaf: function(T,xCenter,yCenter,r,fi,iLevel){
        var LEVEL = 35;

        var x = r*Math.cos(fi) + xCenter;
        var y = r*Math.sin(fi) + yCenter;

        var iMod = fi;
        var iPrecLength = T.prec.length;
        if(iPrecLength>0){
          iMod = ((1==iPrecLength)||(2==iPrecLength)) ? Math.random()*fi : 1;
          iLevel++;
          var Tprev;
          for(var i=0,ii=iPrecLength;i<ii;i++){
              Tprev = app.T[app.getRealIndex(T.prec[i])];
              app.drawLeaf(Tprev,x,y,(200/iLevel)+10*Math.random()*i,(0.6)*Math.PI*(i+1*iPrecLength)/iPrecLength,iLevel);
          }
        }

        iColor = Math.floor(200*T.i/app.iToriginalLength+55);

        if (app.displayColors) {
           g = 255 - iColor;
           r = 0 + Math.floor(iColor / 2);
        } else {
           r = 0;
           g = iColor;
        }
        b = 0;

        // draw branch
        app.ctx.beginPath();
        app.ctx.moveTo(xCenter, yCenter);
        app.ctx.lineTo(x, y);
        app.ctx.strokeStyle = "rgba("+r+","+g+","+b+",0.3)";
        app.ctx.stroke();
        app.ctx.strokeStyle = "rgb(0,0,0)";

        // draw leaf
        app.ctx.beginPath();
        app.ctx.arc(x,y,20/iLevel,0,Math.PI*2,true);
        app.ctx.fillStyle = "rgba("+r+","+g+","+b+",1)";
        app.ctx.fill();

        if (app.bCanvasTextEnabled) {
           T.drawInfo("d*", x - 5, y, true, true);
        }
    },

    getRealIndex: function(thisi){
        var iTableIndex;
        for(var i=0;i<app.T.length;i++)
            if(thisi == app.T[i].i) iTableIndex = i;
        return iTableIndex;
    }
};

/* sorting functions */
function sortEDD(t1,t2){
    return (t1.d == t2.d) ? t1.r - t2.r : t1.d - t2.d;
}
function sortEDDdprec(t1,t2){
    return (t1.dprec == t2.dprec) ? t1.r - t2.r : t1.dprec - t2.dprec;
}
function sortdprec(i1,i2){
    i1 = app.getRealIndex(i1);
    i2 = app.getRealIndex(i2);
    return app.T[i2].dprec - app.T[i1].dprec;
}

function Task(p,r,d,i){
    this.i = i; // original index
    this.p = p; // processing time
    this.r = r; // relase time
    this.d = d; // due time / deadline
    this.s = 0; // starting time
    this.c = 0; // completion time
    this.L = 0; // Lateness (completion time - starting time)
    this.done = false;
    this.prec = [];     // indexes (this.i) of tasks this task is waiting for
    this.dprec = 0;
    this.waiting = [];  // indexes (this.i) of tasks waiting for this task
    this.iNext = false; // index (this.i) of leaf towards the root
    this.M = 0;         // index of machine which processed this task

    this.calculateLateness = function(){
        this.L = this.c - this.d;
    };

    this.isReady = function(){
        if(0 === this.prec.length) return true;
        var bIsReady = true;
        for(var i=0,ii=this.prec.length;i<ii;i++)
            bIsReady = (app.T[app.getRealIndex(this.prec[i])].done && bIsReady) ? true : false;
        return bIsReady;
    };

    this.info = function(sInfo){
        var aInfo = sInfo.split(",");
        sInfo = " Task i="+this.i;
        for(var i=0,ii=aInfo.length;i<ii;i++)
          switch(aInfo[i]){
            case"p": sInfo += " p="+this.p; break;
            case"r": sInfo += " r="+this.r; break;
            case"d": sInfo += " d="+this.d; break;
            case"s": sInfo += " s="+this.s; break;
            case"c": sInfo += " c="+this.c; break;
            case"L": sInfo += " L="+this.L; break;
            case"M": sInfo += " M="+this.M; break;
            case"d*": sInfo += " d*="+this.dprec; break;
            case"prec": sInfo += " prec=["+this.prec+"]"; break;
            case"waiting": sInfo += " waiting=["+this.waiting+"]"; break;
            case"done": sInfo += " done="+this.done; break;
            case"next": sInfo += " next="+this.iNext; break;
          }

        log(sInfo);
    };

    this.drawTask = function(r,g,b,bLineToDeadlineMark){
        // if one line
        var thisi = this.i;
        if(app.bOneLine){
            if("P|pj=1,in-tree|Lmax"== app.sAlgorithm) thisi = this.M;
            else thisi = 1;
        }

        var addUP = ((this.i+1)*50)/app.T.length;

        // write ri
        this.drawInfo("r",app.scale*this.r+app.cnvFRAME+5, app.cnvFRAME+20,false);

        // draw Task rectangle
        app.ctx.beginPath();
        app.ctx.fillStyle = "rgb("+r+","+g+","+b+")";
        app.ctx.fillRect(app.scale*this.s+app.cnvFRAME, thisi*20+app.cnvFRAME+app.cnvUP, app.scale*this.p, 20);

        // draw line Task -> Deadline mark
        if(bLineToDeadlineMark){
          app.ctx.globalAlpha = 0.3;

          app.ctx.beginPath();
          app.ctx.moveTo(app.scale*(this.s+this.p)+app.cnvFRAME-3, thisi*20+app.cnvFRAME+app.cnvUP);
          app.ctx.lineTo(app.scale*(this.s+this.p)+app.cnvFRAME-3, thisi*3 +app.cnvFRAME+addUP);
          app.ctx.lineTo(app.scale*this.d+app.cnvFRAME, thisi*3 +app.cnvFRAME+addUP);
          app.ctx.lineTo(app.scale*this.d+app.cnvFRAME, app.cnvFRAME);

          app.ctx.strokeStyle = "rgb("+r+","+g+","+b+")";
          app.ctx.stroke();
          app.ctx.strokeStyle = "rgb(0,0,0)";

          app.ctx.globalAlpha = 1;
        }

        // write numbers of Tasks if not line chart
        if(!app.bOneLine) {
             canvasWrite(0, thisi*20+app.cnvFRAME+15+app.cnvUP, "T"+this.i,"rgb(0,0,0)",10,true);
        } else {
             canvasWrite(0, thisi*20+app.cnvFRAME+15+app.cnvUP, "M"+this.M,"rgb(0,0,0)",10,true);
             canvasWrite(app.scale*this.s+app.cnvFRAME,
                         thisi*20+app.cnvFRAME+15+app.cnvUP,     ""+this.i,"rgb(0,0,0)",10,true);
        }

/*
        // draw Lateness mark, write L
        if(this.L > 0){
            app.ctx.fillStyle = "rgb(0,0,0)";
            app.ctx.fillRect(app.scale*this.s+app.cnvFRAME+5, thisi*20+app.cnvFRAME+5+app.cnvUP, 10, 10);
            if(!app.bOneLine) {
                this.drawInfo("L",app.scale*this.s+app.cnvFRAME+30, thisi*20+app.cnvFRAME+app.cnvUP+15,true);
            } else {
                this.drawInfo("L",app.scale*this.s+app.cnvFRAME+10, thisi*20+app.cnvFRAME+app.cnvUP+30,true);
            }
        }
*/
    };

    this.drawDeadlineMark = function(r,g,b){
        app.ctx.globalAlpha = 0.6;
        app.ctx.beginPath();
        app.ctx.arc(app.scale*this.d+app.cnvFRAME,app.cnvFRAME,4,0,Math.PI*2,true);
        app.ctx.fillStyle = "rgb("+r+","+g+","+b+")";
        app.ctx.fill();

        app.ctx.globalAlpha = 1;
        this.drawInfo("d",app.scale*this.d+app.cnvFRAME, app.cnvFRAME+20,false,false);
    };

    this.drawInfo = function(sInfo,x,y,bConst,bForceWrite,sColor){
        if(!bConst) {
            y += (this.i*100)/app.T.length;
        }
        sColor = sColor || "rgb(0,0,0)";
        bForceWrite = bForceWrite || false;
        var info;
        switch(sInfo){
            case "p":  info = this.p; break;
            case "r":  info = this.r; break;
            case "d":  info = this.d; break;
            case "d*": info = this.dprec; break;
            case "s":  info = this.s; break;
            case "c":  info = this.c; break;
            case "L":  info = this.L; break;
        }
        canvasWrite(x-20, y,   sInfo,     sColor,10,bForceWrite);
        canvasWrite(x-10, y+5, ""+this.i, sColor, 6,bForceWrite);
        canvasWrite(x-2,  y,   "="+info,  sColor,10,bForceWrite);
    };
}

/* drawing functions */
function drawXOY(){
    app.ctx.beginPath();
    app.ctx.moveTo(app.cnvFRAME,app.cnvFRAME);
    app.ctx.lineTo(app.cnvWIDTH,app.cnvFRAME);
    app.ctx.moveTo(app.cnvWIDTH-app.cnvFRAME+app.cnvFRAME,app.cnvFRAME);
    app.ctx.lineTo(app.cnvWIDTH-app.cnvFRAME,app.cnvFRAME-app.cnvFRAME/3);
    app.ctx.moveTo(app.cnvWIDTH-app.cnvFRAME+app.cnvFRAME,app.cnvFRAME);
    app.ctx.lineTo(app.cnvWIDTH-app.cnvFRAME,app.cnvFRAME+app.cnvFRAME/3);
    app.ctx.stroke();
    app.ctx.moveTo(app.cnvFRAME,app.cnvFRAME);
    app.ctx.lineTo(app.cnvFRAME,app.cnvHEIGHT+app.cnvFRAME-20);
    app.ctx.lineTo(app.cnvFRAME-app.cnvFRAME/3,app.cnvHEIGHT-app.cnvFRAME);
    app.ctx.moveTo(app.cnvFRAME,app.cnvHEIGHT+app.cnvFRAME-20);
    app.ctx.lineTo(app.cnvFRAME+app.cnvFRAME/3,app.cnvHEIGHT-app.cnvFRAME);
    app.ctx.stroke();
}

function drawScale(){
    for(var i=1;i<app.maxWidth;i++){
        app.ctx.beginPath();
        app.ctx.moveTo(app.scale*i+app.cnvFRAME, app.cnvFRAME-5);
        app.ctx.lineTo(app.scale*i+app.cnvFRAME, app.cnvFRAME+5);
        app.ctx.stroke();
    }
}

function switchDisplayLog(){
    if(app.displayLog){
        document.getElementById("inpL").value = "log:N";
        app.displayLog = false;
    } else {
        document.getElementById("inpL").value = "log:Y";
        app.displayLog = true;
    }
    app.drawChart();
}

function switchDisplayColors(){
    if(app.displayColors){
        document.getElementById("inpK").value = "rgb:N";
        app.displayColors = false;
    } else {
        document.getElementById("inpK").value = "rgb:Y";
        app.displayColors = true;
    }
    app.drawChart();
}

function checkOneLine(){
    app.bOneLine = ("chart:M" == document.getElementById("inpD").value) ? true : false;
}

function checkAlgType(){
    app.sAlgorithm = document.getElementById("inpA").value;
}

function switchAlgType(){
    var inpPmin = document.getElementById("inpPmin");
    var inpPmax = document.getElementById("inpPmax");
    var inpRmin = document.getElementById("inpRmin");
    var inpRmax = document.getElementById("inpRmax");
    var inpTnum = document.getElementById("inpTnum");
    var inpMnum = document.getElementById("inpMnum");

    var sPrevAlgorithm = document.getElementById("inpA").value;
    switch(sPrevAlgorithm){
        case"P|pj=1,in-tree|Lmax":
            document.getElementById("inpA").value = "1||Lmax";
            app.sAlgorithm = "1||Lmax";
            inpPmin.disabled = false; inpPmin.value = 1;
            inpPmax.disabled = false; inpPmax.value = 9;
            inpRmin.disabled = true;  inpRmin.value = 0;
            inpRmax.disabled = true;  inpRmax.value = 0;
            inpMnum.disabled = true;  inpMnum.value = 1;
            break;
        case"1||Lmax":
            document.getElementById("inpA").value = "1|rj,prm|Lmax";
            app.sAlgorithm = "1||Lmax";
            inpPmin.disabled = false; inpPmin.value = 1;
            inpPmax.disabled = false; inpPmax.value = 9;
            inpRmin.disabled = false; inpRmin.value = 0;
            inpRmax.disabled = false; inpRmax.value = 9;
            inpMnum.disabled = true;  inpMnum.value = 1;
            break;
        case"1|rj,prm|Lmax":
            document.getElementById("inpA").value = "1|rj,prm,prec|Lmax";
            app.sAlgorithm = "1|rj,prm,prec|Lmax";
            inpPmin.disabled = false; inpPmin.value = 1;
            inpPmax.disabled = false; inpPmax.value = 9;
            inpRmin.disabled = false; inpRmin.value = 0;
            inpRmax.disabled = false; inpRmax.value = 9;
            inpMnum.disabled = true;  inpMnum.value = 1;
            break;
      case"1|rj,prm,prec|Lmax":
            document.getElementById("inpA").value = "P|pj=1,in-tree|Lmax";
            app.sAlgorithm = "P|pj=1,in-tree|Lmax";
            inpPmin.disabled = true;  inpPmin.value = 1;
            inpPmax.disabled = true;  inpPmax.value = 1;
            inpRmin.disabled = true;  inpRmin.value = 0;
            inpRmax.disabled = true;  inpRmax.value = 0;
            inpTnum.disabled = false; inpTnum.value = 9;
            inpMnum.disabled = false; inpMnum.value = 3;
            break;
    }
}
function switchChartType(){
    if("chart:M" == document.getElementById("inpD").value){
        document.getElementById("inpD").value = "chart:T";
        app.bOneLine = false;
    } else {
        document.getElementById("inpD").value = "chart:M";
        app.bOneLine = true;
    }
    app.drawChart();
}

function switchCanvasText(){
    if(app.bCanvasTextEnabled){
        document.getElementById("inpC").value = "txt:N";
        app.bCanvasTextEnabled = false;
    } else {
        document.getElementById("inpC").value = "txt:Y";
        app.bCanvasTextEnabled = true;
    }
    app.drawChart();
}

function checkRandomTasks(){
    if(document.getElementById("inpR").checked){
        app.bRandomTasks = true;
    } else {
        alert("tylko dane generowane losowo");
        document.getElementById("inpR").checked = true;
        app.bRandomTasks = true;
    }
}

function canvasWrite(x,y,sText,sColor,fontsize,bForceWrite){
    if(app.bCanvasTextEnabled || bForceWrite){
        fontsize = fontsize || 8;
        x += app.ctx.fontAscent("sans",fontsize);
        sColor = sColor || "rgb(0,0,0)";
        app.ctx.strokeStyle = sColor;
        app.ctx.drawTextCenter("sans",fontsize,x,y,sText);
        // set default strokeStyle as black
        app.ctx.strokeStyle = "rgb(0,0,0)";
    }
}

function checkDecimal(inp,iMin,iMax,iDefault){
    var sString = inp.value;
    if(!isNumeric(sString) || (sString<iMin) || (iMax<sString)){
        inp.value = iDefault;
        alert("Wymagana liczba calkowita z zakresu ["+iMin+","+iMax+"]");
        return false;
    }
    return true;
}

function isNumeric(sString){
    var sValidChars = "0123456789";
    var sChar;
    var bResult = true;

    if(sString.length === 0) return false;

    for(i = 0; i < sString.length && bResult === true; i++){
        sChar = sString.charAt(i);
        if(sValidChars.indexOf(sChar) == -1) bResult = false;
    }
    return bResult;
}

function showInfo(){
    var sTxt = [];
    sTxt.push("<center>Systemy czasu rzeczywistego, WFMiIS, Informatyka, I sum, 08/09");
    sTxt.push("2008.12.14, wersja: 1.4");
    sTxt.push("<h2>Minimalizacja maksymalnego opoznienia");
    sTxt.push("1||Lmax");
    sTxt.push("1|rj,prm|Lmax");
    sTxt.push("1|rj,prm,prec|Lmax");
    sTxt.push("P|pj=1,in-tree|Lmax</h2>");
    sTxt.push("");
    sTxt.push("Z uwagi na wykorzystanie w projekcie elementu graficznego &lt;canvas&gt;");
    sTxt.push("skrypt dziala tylko w przegladarkach internetowych");
    sTxt.push("opartych na silniku co najmniej Gecko 1.8 (FireFox od wersji 1.5)");
    sTxt.push("W zwiazku z ograniczeniami przegladarek internetowych");
    sTxt.push("opartych na silnikach starszych niz Gecko 1.9.1 (FireFox 3.1)");
    sTxt.push("wykorzystalem skrypt Jima Studta <a href='canvastext.js'>canvastext.js</a>");
    sTxt.push("  <a href='http://www.federated.com/~jim/canvastext'>http://www.federated.com/~jim/canvastext</a>");
    sTxt.push("pozwalajacy na renderowanie tekstu w elemencie &lt;canvas&gt;</center>");
    app.log.innerHTML = sTxt.join("<br/>");
}

/* log functions */
function log(sText,bBold,iIndent){
    iIndent = parseInt(iIndent) || 0;
    var buf = "<br>";
    for(var i=0; i < iIndent; i++) buf += " ";
    buf += bBold ? "<b>" : "";
    buf += sText;
    buf += bBold ? "</b>" : "";
    app.buf += buf;
}
function log1(sText){
    log(sText,false,1);
}
function log2(sText){
    log(sText,false,2);
}
function logh(sText){
    log(sText,true);
}
function logbr(){
    log("",false);
}
function outputLog(){
    if(app.displayLog) app.log.innerHTML += app.buf;
}
function clearLog(){
    app.buf = "";
    app.log.innerHTML = "";
}
