Array.prototype.inArray = function(x){
    for(var i=0,l=this.length;i<l;i++)
        if(this[i] == x) return true;
    return false;
};

var $ = (function() {
    var elements = {};
    return function(id){
        if(typeof elements[id] === "undefined") {
            elements[id] = document.getElementById(id);
        }
        return elements[id];
    };
}());

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
    cnv: null,
    w:   0, // cnv width
    h:   0, // cnv height
    f:  20, // cnv XOY top left padding
    u: 150, // Tasks/Machines top line
    wmax: 0,
    scale: 1,

    // config
    displayLog: true,
    displayColors: false,
    displayLateness: true,
    bOneLine: false,
    bRandomTasks: false,
    bCanvasTextEnabled: false,
    sAlgorithm: "",
    buf: "",

    init: function(){
        app.cnv = $("cnvsChart");
        app.w = parseInt(app.cnv.width);
        app.h = parseInt(app.cnv.height);
        app.ctx = app.cnv.getContext("2d");

        app.ctx.write = function(x,y,sText,sColor,fontsize,bForceWrite){
            var ctx = app.ctx;
            if(app.bCanvasTextEnabled || bForceWrite){
                fontsize = fontsize + 2 || 8;
                ctx.font = "normal normal normal "+fontsize+"px sans-serif";
                ctx.fillStyle = sColor || "rgb(0,0,0)";
                ctx.fillText(sText,++x,y);
                // set default fillStyle to black
                ctx.fillStyle = "rgb(0,0,0)";
            }
        };

        app.setAlgorithm("P|pj=1,in-tree|Lmax");
        app.start();
        app.showInfo();
    },

    start: function(){
        $("inpG").disabled = true;

        // clear Tasks and content, check settings...
        app.T = [];
        app.aReadyTasks = [];
        clearLog();
        app.checkOneLine();
        app.checkRandomTasks();

        app.generateTasks();

        switch(app.sAlgorithm){
            case "1||Lmax":
                logh("Generated tasks:");
                app.showAllTasks("p,r,d");

                logbr();

                logh("Arrange tasks in EDD order");
                app.T.sort(app.sortEDD);
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
                app.T.sort(app.sortEDD);
                app.showAllTasks("p,r,d");

                logbr();

                logh("Schedule tasks (Liu algorithm)");
                app.scheduler2();

                logbr();

                logh("Scheduled tasks:");
                app.calculateLatenesses();
                app.showAllTasks("p,r,d,s,c,L");
            break;

            case "1|rj,prm,prec|Lmax":
                logh("Generated tasks:");
                app.showAllTasks("p,r,d,prec,waiting");

                logbr();

                logh("Calculate d* and arrange tasks in EDD dprec order");
                app.setdprec3();
                app.T.sort(app.sortEDDdprec);
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

        $("inpG").disabled = false;
    },

    generateTasks: function(){
        var n = parseInt($("inpTnum").value);

        if(app.bRandomTasks){
            var pmin,pmax,rmin,rmax,dmin,dmax;
            var pRand,rRand,dRand;
            pmin = parseInt($("inpPmin").value);
            pmax = parseInt($("inpPmax").value);
            rmin = parseInt($("inpRmin").value);
            rmax = parseInt($("inpRmax").value);
            dmin = parseInt($("inpDmin").value);
            dmax = parseInt($("inpDmax").value);
            app.iM = parseInt($("inpMnum").value);

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

    /* schedulers */

    /* 1||Lmax */
    scheduler1: function(){
        var t = 0;
        for(var i=0,ii=app.T.length;i<ii;i++){
            app.T[i].s = t;
            app.T[i].c = t + app.T[i].p;
            t = t + app.T[i].p;
        }
    },

    /* 1|rj,prm|Lmax */
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
            app.T.sort(app.sortEDD);

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
                if(!bIsFreeR && t < app.T[i].r){
                    iFirstFreeR = i;
                    bIsFreeR = true;
                }
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

    /* 1|rj,prm,prec|Lmax */
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
            app.T.sort(app.sortEDDdprec);

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
                if(!bIsFreeR && t < app.T[i].r){
                    iFirstFreeR = i;
                    bIsFreeR = true;
                    Tfirst = app.T[iFirstFreeR];
                }
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

    /* P|pj=1,in-tree|Lmax */
    scheduler4: function(t){
        t = t || 0;
        log1("checking tasks at t="+t);
        app.aReadyTasks.sort(app.sortdprec);
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
            T.M = i+1;
            T.done = true;
            log2("T["+T.i+"] completed on M["+T.M+"]");
            if(T.iNext === false){
                log1("all tasks completed");
            } else {
                // if possible add next tasks to ready queue
                var bReady = true;
                var Tnext = app.T[app.getRealIndex(T.iNext)];
                for(var j=0,jj=Tnext.prec.length;j<jj;j++){
                    bReady = bReady && app.T[app.getRealIndex(Tnext.prec[j])].done;
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

    /* sorting functions */

    sortEDD: function(t1,t2){
        return (t1.d == t2.d) ? t1.r - t2.r : t1.d - t2.d;
    },

    sortEDDdprec: function(t1,t2){
        return (t1.dprec == t2.dprec) ? t1.r - t2.r : t1.dprec - t2.dprec;
    },

    sortdprec: function(i1,i2){
        i1 = app.getRealIndex(i1);
        i2 = app.getRealIndex(i2);
        return app.T[i2].dprec - app.T[i1].dprec;
    },

    /* drawing functions */

    getColor: function(i){
        var r,g,b,iColor;
        iColor = Math.floor(200*app.T[i].i/app.iToriginalLength+55);

        if(app.displayColors){
            r = 0 + Math.floor(iColor / 2);
            g = 255 - iColor;
            b = 0;
        } else {
            r = 0;
            g = iColor;
            b = 0;
        }

        return [r,g,b];
    },

    drawChart: function(){
        // clear previous content
        app.ctx.clearRect(0,0,app.w,app.h);
        app.ctx.buffer = {
            'p': [],
            'r': [],
            'rj': [],
            'd': [],
            'd*': [],
            's': [],
            'c': [],
            'L': [],
            'T': [],
            'M': []
        };
        // scale...
        app.wmax = 0;
        app.scale = 1;
        for(var i=0,ii=app.T.length;i<ii;i++){
            if(app.T[i].c > app.wmax) app.wmax = app.T[i].c;
            if(app.T[i].d > app.wmax) app.wmax = app.T[i].d;
        }
        app.scale = (app.w-2*app.f)/app.wmax;

        app.drawXOY();

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
            app.T[i].drawDeadlineLine(aRGB[0],aRGB[1],aRGB[2]);
            app.T[i].drawDeadlineMark(aRGB[0],aRGB[1],aRGB[2]);
        }
        for(var i=0,ii=app.T.length;i<ii;i++){
            aRGB = app.getColor(i);
            app.T[i].drawTask(aRGB[0],aRGB[1],aRGB[2],iMax[i]);
        }

        if("P|pj=1,in-tree|Lmax"== app.sAlgorithm)
            app.drawChartTree();
    },

    drawChartTree: function(){
        var Troot = app.T[app.getRealIndex(app.iTroot)];
        app.drawLeaf(Troot,app.w-50,app.h-20,10,Math.PI*5/4,0);
    },

    drawLeaf: function(T,xCenter,yCenter,r,fiDir,iLevel,fiLimit){
        var ctx = app.ctx;
        var x = r*Math.cos(fiDir) + xCenter;
        var y = r*Math.sin(fiDir) + yCenter;
        var fiMax = iLevel ? fiLimit : Math.PI*0.35;
        var fiMin = fiDir - fiMax/2;
        var iPrecLength = T.prec.length;
        r = 30 - iLevel*15 + iPrecLength*10;
        for(var i=0,ii=iPrecLength;i<ii;i++){
            var Tprev = app.T[app.getRealIndex(T.prec[i])];
            if(iPrecLength > 1){
                var fiPart = fiMax/(iPrecLength-1);
                if(fiPart < 0.35) fiPart = 0.35;
                fiDir = fiMin + fiPart*i;
                r = r + i*14;
            }
            if(r < 40) r = 40;
            if(r > 80) r = 80;
            app.drawLeaf(Tprev,x,y,r,fiDir,iLevel+1,fiMax/iPrecLength);
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
        ctx.beginPath();
        ctx.moveTo(xCenter, yCenter);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "rgba("+r+","+g+","+b+",0.3)";
        ctx.stroke();
        ctx.strokeStyle = "rgb(0,0,0)";

        // draw leaf
        ctx.beginPath();
        ctx.arc(x,y,Math.abs(10-1.3*(iLevel+1)),0,Math.PI*2,true);
        ctx.fillStyle = "rgba("+r+","+g+","+b+",1)";
        ctx.fill();

        if (app.bCanvasTextEnabled) {
            T.drawInfo("d*", x, y+15-iLevel, true, true);
        }
    },

    getRealIndex: function(ti){
        var iTableIndex;
        for(var i=0;i<app.T.length;i++)
            if(ti == app.T[i].i) iTableIndex = i;
        return iTableIndex;
    },

    drawXOY: function(){
        var ctx = app.ctx, w = app.w, h = app.h, f = app.f, scale = app.scale;
        ctx.beginPath();
        ctx.moveTo(f,f);
        ctx.lineTo(w,f);
        ctx.moveTo(w-f+f,f);
        ctx.lineTo(w-f,f-f/3);
        ctx.moveTo(w-f+f,f);
        ctx.lineTo(w-f,f+f/3);
        ctx.stroke();
        ctx.moveTo(f,f);
        ctx.lineTo(f,h+f-20);
        ctx.lineTo(f-f/3,h-f);
        ctx.moveTo(f,h+f-20);
        ctx.lineTo(f+f/3,h-f);
        ctx.stroke();

        // horizontal scale
        for(var i=1;i<app.wmax;i++){
            ctx.beginPath();
            ctx.moveTo(scale*i+f,f-5);
            ctx.lineTo(scale*i+f,f+5);
            ctx.stroke();
        }
    },

    drawXOYlabel: function(sInfo,i,x,y,sText){
        var ctx = app.ctx;
        if(!ctx.buffer[sInfo][i]){
            ctx.buffer[sInfo][i] = true;
            ctx.write(x,y,sText,"rgb(0,0,0)",10,true);
        }
    },

    /* UI */

    switchDisplayLateness: function(){
        if(app.displayLateness){
            $("inpL").value = "Lj:N";
            app.displayLateness = false;
        } else {
            $("inpL").value = "Lj:Y";
            app.displayLateness = true;
        }
        app.drawChart();
    },

    switchDisplayLog: function(){
        if(app.displayLog){
            $("inpLog").value = "log:N";
            app.displayLog = false;
        } else {
            $("inpLog").value = "log:Y";
            app.displayLog = true;
        }
        app.drawChart();
    },

    switchDisplayColors: function(){
        if(app.displayColors){
            $("inpK").value = "rgb:N";
            app.displayColors = false;
        } else {
            $("inpK").value = "rgb:Y";
            app.displayColors = true;
        }
        app.drawChart();
    },

    checkOneLine: function(){
        app.bOneLine = "chart:M" == $("inpD").value;
    },

    setAlgorithm: function(sAlgorithm){
        var inpPmin = $("inpPmin");
        var inpPmax = $("inpPmax");
        var inpRmin = $("inpRmin");
        var inpRmax = $("inpRmax");
        var inpMnum = $("inpMnum");

        switch(sAlgorithm){
            case"1||Lmax":
                inpPmin.disabled = false; inpPmin.value = 1;
                inpPmax.disabled = false; inpPmax.value = 9;
                inpRmin.disabled = true;  inpRmin.value = 0;
                inpRmax.disabled = true;  inpRmax.value = 0;
                inpMnum.disabled = true;  inpMnum.value = 1;
                break;
            case"1|rj,prm|Lmax":
                inpPmin.disabled = false; inpPmin.value = 1;
                inpPmax.disabled = false; inpPmax.value = 9;
                inpRmin.disabled = false; inpRmin.value = 0;
                inpRmax.disabled = false; inpRmax.value = 9;
                inpMnum.disabled = true;  inpMnum.value = 1;
                break;
            case"1|rj,prm,prec|Lmax":
                inpPmin.disabled = false; inpPmin.value = 1;
                inpPmax.disabled = false; inpPmax.value = 9;
                inpRmin.disabled = false; inpRmin.value = 0;
                inpRmax.disabled = false; inpRmax.value = 9;
                inpMnum.disabled = true;  inpMnum.value = 1;
                break;
            case"P|pj=1,in-tree|Lmax":
                inpPmin.disabled = true;  inpPmin.value = 1;
                inpPmax.disabled = true;  inpPmax.value = 1;
                inpRmin.disabled = true;  inpRmin.value = 0;
                inpRmax.disabled = true;  inpRmax.value = 0;
                inpMnum.disabled = false; inpMnum.value = 5;
                break;
        }
        app.sAlgorithm = sAlgorithm;
        $("inpA").value = sAlgorithm;
    },

    switchAlgorithm: function(){
        switch($("inpA").value){
            case"1||Lmax":  app.setAlgorithm("1|rj,prm|Lmax"); break;
            case"1|rj,prm|Lmax": app.setAlgorithm("1|rj,prm,prec|Lmax"); break;
            case"1|rj,prm,prec|Lmax": app.setAlgorithm("P|pj=1,in-tree|Lmax"); break;
            case"P|pj=1,in-tree|Lmax": app.setAlgorithm("1||Lmax"); break;
        }
    },

    switchChartType: function(){
        if("chart:M" == $("inpD").value){
            $("inpD").value = "chart:T";
            app.bOneLine = false;
        } else {
            $("inpD").value = "chart:M";
            app.bOneLine = true;
        }
        app.drawChart();
    },

    switchCanvasText: function(){
        if(app.bCanvasTextEnabled){
            $("inpC").value = "txt:N";
            app.bCanvasTextEnabled = false;
        } else {
            $("inpC").value = "txt:Y";
            app.bCanvasTextEnabled = true;
        }
        app.drawChart();
    },

    showInfo: function(){
        $("log").innerHTML = [
            "<center>Systemy czasu rzeczywistego, WFMiIS, Informatyka, I sum, 08/09",
            "2008.12.14, wersja: 1.4",
            "<h2>Minimalizacja maksymalnego opoznienia",
            "1||Lmax",
            "1|rj,prm|Lmax",
            "1|rj,prm,prec|Lmax",
            "P|pj=1,in-tree|Lmax</h2>",
            "",
            "Z uwagi na wykorzystanie w projekcie elementu graficznego &lt;canvas&gt;",
            "skrypt dziala tylko w przegladarkach internetowych",
            "opartych na silniku co najmniej Gecko 1.8 (FireFox od wersji 1.5)</center>"
        ].join("<br/>");
    },

    checkRandomTasks: function(){
        if($("inpR").checked){
            app.bRandomTasks = true;
        } else {
            alert("tylko dane generowane losowo");
            $("inpR").checked = true;
            app.bRandomTasks = true;
        }
    },

    checkDecimal: function(inp,iMin,iMax,iDefault){
        var sString = inp.value;
        if(!app.isNumeric(sString) || (sString<iMin) || (iMax<sString)){
            inp.value = iDefault;
            alert("Wymagana liczba calkowita z zakresu ["+iMin+","+iMax+"]");
            return false;
        }
        return true;
    },

    isNumeric: function(sString){
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
};

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
}

Task.prototype.calculateLateness = function(){
    this.L = this.c - this.d;
};

Task.prototype.isReady = function(){
    if(0 === this.prec.length) return true;
    var bIsReady = true;
    for(var i=0,ii=this.prec.length;i<ii;i++)
        bIsReady = app.T[app.getRealIndex(this.prec[i])].done && bIsReady;
    return bIsReady;
};

Task.prototype.info = function(sInfo){
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

Task.prototype.drawTask = function(r,g,b){
    var ctx = app.ctx, f = app.f, u = app.u, scale = app.scale;

    // if one line
    var ti = this.i;
    if(app.bOneLine){
        if("P|pj=1,in-tree|Lmax" == app.sAlgorithm) ti = this.M;
        else ti = 1;
    }

    // write ri
    if("P|pj=1,in-tree|Lmax" == app.sAlgorithm || "1||Lmax" == app.sAlgorithm){
        this.drawInfo("rj",scale*this.r+f+5, f+20,false);
    } else {
        this.drawInfo("r",scale*this.r+f+5, f+20,false);
    }

    // draw Task rectangle
    ctx.beginPath();
    ctx.fillStyle = "rgb("+r+","+g+","+b+")";
    ctx.fillRect(scale*this.s+f, ti*20+f+u, scale*this.p, 20);

    // draw Lateness mark, write Lj
    if(app.displayLateness && this.L > 0){
        ctx.fillStyle = "rgb(204,255,204)";
        ctx.fillRect(scale*this.s+f+2, ti*20+f+u+2,7,16);
        if(!app.bOneLine) {
            this.drawInfo("L",scale*this.s+f+20, (1+ti)*20+f+u+10,true);
        } else {
            this.drawInfo("L",scale*this.s+f+20, (app.iM+1)*20+f+u+10,true);
        }
    }

    if(!app.bOneLine) {
        app.drawXOYlabel("T",this.i,0,ti*20+f+15+u,"T"+this.i);
    } else {
        app.drawXOYlabel("M",this.M,0,ti*20+f+15+u,"M"+this.M);
        // write numbers of Tasks if not line chart
        ctx.write(scale*this.s+f,ti*20+f+15+u,""+this.i,"rgb(0,0,0)",10,true);
    }
};

Task.prototype.drawDeadlineLine = function(r,g,b){
    var ctx = app.ctx, f = app.f, u = app.u, scale = app.scale;
    // separate horizontal parts of deadline lines
    var ds = ((this.i+1)*50)/app.T.length;
    // if one line
    var ti = this.i;
    if(app.bOneLine){
        if("P|pj=1,in-tree|Lmax" == app.sAlgorithm) ti = this.M;
        else ti = 1;
    }
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(scale*(this.s+this.p)+f-ti, ti*20+f+u);
    ctx.lineTo(scale*(this.s+this.p)+f-ti, ti*10 +f+ds);
    ctx.lineTo(scale*this.d+f, ti*10 +f+ds);
    ctx.lineTo(scale*this.d+f, f);
    ctx.strokeStyle = "rgb("+r+","+g+","+b+")";
    ctx.stroke();
    ctx.strokeStyle = "rgb(0,0,0)";
    ctx.globalAlpha = 1;
};

Task.prototype.drawDeadlineMark = function(r,g,b){
    var ctx = app.ctx, f = app.f, scale = app.scale;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(scale*this.d+f,f,4,0,Math.PI*2,true);
    ctx.fillStyle = "rgb("+r+","+g+","+b+")";
    ctx.fill();
    ctx.globalAlpha = 1;
    this.drawInfo("d",scale*this.d+f,f+20,false,false);
};

Task.prototype.drawInfo = function(sInfo,x,y,bConst,bForceWrite,sColor){
    sColor = sColor || "rgb(0,0,0)";
    bForceWrite = bForceWrite || false;
    var info;
    var sParam = sInfo;
    var sIndex = ""+this.i;
    var ti = this.i;
    switch(sInfo){
        case "p":  info = this.p; break;
        case "r":  info = this.r; break;
        case "rj": info = this.r; sParam = "r"; sIndex = "j"; ti = 0; break;
        case "d":  info = this.d; break;
        case "d*": info = this.dprec; break;
        case "s":  info = this.s; break;
        case "c":  info = this.c; break;
        case "L":  info = this.L; break;
    }
    var ctx = app.ctx;
    if(!bConst) {
        y += (this.i*100)/app.T.length;
    }
    if(!ctx.buffer[sInfo][ti]){
        ctx.buffer[sInfo][ti] = true;
        ctx.write(x-20, y,   sParam,    sColor,10,bForceWrite);
        ctx.write(x-12, y+5, sIndex,    sColor, 7,bForceWrite);
        ctx.write(x-5,  y,   "="+info,  sColor,10,bForceWrite);
    }
};

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
    if(app.displayLog) $("log").innerHTML += app.buf;
}
function clearLog(){
    $("log").innerHTML = "";
    app.buf = "";
}
