// ==UserScript==
// @name         SG Show Banned Games
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Show banned games on creating new games
// @author       mh
// @downluadURL  https://github.com/maherm/steamgifts_scripts/raw/master/sg_show_banned_games.user.js
// @match        https://www.steamgifts.com/giveaways/new
// @grant        none
// ==/UserScript==
var games =JSON.parse(localStorage["__mh_free_games"] || "[]");
$.get("https://www.steamgifts.com/discussion/pJRbR/",function(data){
    games = $(data).find("p:contains(Current list of banned games)~ul li").map(function(){return $(this).text();});
    localStorage ["__mh_free_games"] = JSON.stringify(games);
});

var findMatches = function(str){
    if(str.trim().length===0) return [];
    var re = new RegExp(str,"i");
    return games.filter(function(idx,el){return re.test(el.replace(/\s+/g, ''));});
};

var addBanned= function(name){
    var $thing = $('<div data-autocomplete-name="'+name+'" class="__table_row_banned table__row-outer-wrap table__row-outer-wrap--fade-siblings" style="border-bottom: 1px solid #d2d6e0;"><div class="table__row-inner-wrap" style="opacity: 1;"><div><div class="global__image-outer-wrap global__image-outer-wrap--game-small global__image-outer-wrap--missing-image"><i class="fa fa-ban"></i></div></div><div class="table__column--width-fill"><p class="table__column__heading" style="color:#989a9c;cursor:default;">'+name+'</p><p></p></div><a target="_blank" class="tags tags_bundle" title="Banned" href="https://www.steamgifts.com/discussion/pJRbR/can-we-have-a-list-of-games-that-cannot-be-created-as-giveaway-unofficial-list-inside/search?q='+encodeURI(name)+'" style="float: right; display: inline-block;color:#d42929;">Banned</a></div></div>');
    var r = $(".__mh_free_games_rows");
    if(r.length===0){
        r = $("<div class='table__rows __mh_free_games_rows'>").insertBefore(".js__autocomplete-data");
    }
    r.prepend($thing);
};

var clear = function(){
    $(".__table_row_banned").remove();
};

var updateResults = function(){
   clear();
    var matches = findMatches($(".js__autocomplete-name").val().replace(/\s+/g, ''));
    matches.each(function(i,e){addBanned(e);});
};

var observer = new MutationObserver(updateResults);
observer.observe($(".js__autocomplete-data")[0], {childList:true});

$(".js__autocomplete-name").on("change paste keyup",updateResults);
$(document).on("click", ".js__autocomplete-data .table__row-outer-wrap.is-clickable", clear);



