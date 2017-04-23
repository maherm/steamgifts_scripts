// ==UserScript==
// @name         SG Bookmarks
// @namespace    http://steamgifts.com/
// @version      1.0.0
// @description  Bookmark giveaways
// @author       mahermen,crazoter
// @downloadURL  https://github.com/maherm/steamgifts_scripts/raw/master/sg_bookmarks.user.js
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.7/sgapi.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.7/sgapi_gatools.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.7/sgapi_settings.js
// @require      http://momentjs.com/downloads/moment.min.js
// @resource     css https://raw.githubusercontent.com/crazoter/steamgifts_scripts/master/sg_bookmarks.css
// @include      http*://www.steamgifts.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_getResourceText
// ==/UserScript==

/*jshint multistr: true */

use(SgApi);
use(Util); /*Same as: use(SgApi.Util);*/

//Runtime variables
var data = new Data();
var lazyTrainManager = {};//Format:{ {desc1:String}: {timesOccured:int},{desc2:String}: {timesOccured:int},... }
var prevNavRow;
var navRowIsTrain = false;
var queuedBookmarkIds = getQueuedBookmarkIds();
var current_queued_id_count = 0;
var lastBuildTime = 0;
var lastSyncAllTimestamp = GM_getValue("__mh_lastSyncAllTimestamp",-1);
var gaClickHandlersInitialized = false;
var timer; //Timeout till next scheduled redraw

//Settings
var SETTINGS_STATES = "Show giveaway status";
var SETTINGS_TRAIN = "Group giveaways in a train";

//CONSTANTS
var STATE_NOT_ENTERED = "unentered";
var STATE_ENTERED = "entered";
var STATE_OWNED = "owned";
var STATE_ENDED = "ended";
var MAX_BOOKMARK_STR_LENGTH = 39;
var SYNC_ALL_EXPIRY_PERIOD_S = 60*60;
var SYNC_QUEUED_MAX_CONCURRENT_IDS = 3;


function main(){
	syncQueuedBookmarkIds();
	syncAllIfRequired();
	requireDeclaredStyles();
	readBookmarks();
	initSettings();
	if(isGiveaway()){
		if(amIBookmarked()) {
       initGAClickHandlers();
		}
	  showButton();
	}
	if($(".form__sync-default").length > 0) {//Sync bookmarks too when syncing steam
		$(".form__sync-default").click(function(){ syncAllEnteredBookmarks(); });
	}
	addNavButton();
}

function isBookmarkContainerOpenend(){
    return !$(".___mh_bookmark_outer_container.nav__relative-dropdown").hasClass("is-hidden");
}

function closeBookmarkContainer(){
	var $button = $('.__mh_bookmark_button');
	var $dropdown = $(".___mh_bookmark_outer_container.nav__relative-dropdown");
	$dropdown.addClass("is-hidden");
	$button.removeClass("nav__button-container--active").addClass("nav__button-container--inactive");
}

function markForRebuild(){
    GM_setValue("__mh_bookmarksLastChanged", moment().valueOf());
}

function setBuiltTimestamp(){
    lastBuildTime = moment().valueOf();
}

function getLastChangedTimestamp(){
    return +GM_getValue("__mh_bookmarksLastChanged", moment().valueOf());
}

function rebuildNavRows(){
 return moment(getLastChangedTimestamp()).isAfter(lastBuildTime);
}

function doFullRebuild(){
    readBookmarks();
    updateButtonState();
    updateBadge();
    buildNavRows();
    setBuiltTimestamp();
}

function openBookmarkContainer(e){
	var  $t=$(this);
	setTimeout(function(){
		  if(rebuildNavRows()) { doFullRebuild(); }
			$t.addClass("nav__button-container--active");
			$(".___mh_bookmark_outer_container.nav__relative-dropdown").removeClass("is-hidden");
			$("html, body").animate({ scrollTop: 0 }, "fast");
	},0);
	return false;
}

function addBookmarkMenuItem(title,descr,url,imgUrl,hasEnded,id,state){
	var $html = createBookmarkMenuItem(title,descr,url,imgUrl,hasEnded,id,state);
	$(".__mh_bookmark_container").append($html);
	prevNavRow = document.getElementById('__mh_'+id);
}

function createBookmarkMenuItem(title,descr,url,imgUrl,hasEnded,id,state){
	var settings_states = data.settings.get(SETTINGS_STATES);
	var settings_train = data.settings.get(SETTINGS_TRAIN);
		var $html = $('<a class="nav__row" id="__mh_'+id+'"></a>');
	$html.addClass("__mh_bookmark_item");
	if(hasEnded)
		 $html.addClass(" __mh_ended");
	else if(settings_states && state) 
		 $html.addClass("__mh_state_"+state);
	if(url)
		$html.attr("href",url);
	if(settings_train) {
		if(!lazyTrainManager[descr]) {//First time seeing this descript
			 lazyTrainManager[descr] = 1;
			if(navRowIsTrain && prevNavRow) {//apply "track end" style to last train giveaway
				$(prevNavRow).addClass("__mh_train_end");
			}
			navRowIsTrain = false;
			} else {
				navRowIsTrain = true;
				lazyTrainManager[descr]++;
				$html.addClass("__mh_mid_train");//Trains usually: 1. Are by the same person and 2. End at the same time
				$html.append('<i class="__mh_train_tracks"></i>');
			}
		}
	if(imgUrl)
		$html.append('<img class="__mh_nav_row_img" src="'+imgUrl+'">');
	var $div = $('<div class="nav__row__summary">');
	var $titleP = $('<p class="nav__row__summary__name">'+(title?title:"")+'</p>');
	var $descrP = $('<p class="nav__row__summary__description">'+(descr?descr:'')+'</p>');
	$div.append($titleP);
	$div.append($descrP);
	$html.append($div);
	if(id){
		var $remove = $('<i class="icon-red fa fa-times-circle __mh_bookmark_item_remove_btn"></i>');
		$remove.click(function(){
			toggleBookmark(id);
			updateButtonState();
			updateBadge();
			return false;
		});
		$html.append($remove);
	}
	return $html;
}

function addNavRow(bookmarkData){
	var n = new NavRow(bookmarkData);
	addBookmarkMenuItem(n.title,n.descr,n.url,n.imgUrl,n.hasEnded,n.id,n.state);
}

function enterNavRow(gaId,entering) {
	var domId = "#__mh_"+gaId;
	if(entering) {
		$(domId).removeClass( "__mh_state_unentered" ).addClass("__mh_state_entered");
	} else {
		$(domId).removeClass( "__mh_state_entered" ).addClass("__mh_state_unentered");
	}
}

function removeNavRow(gaId) {
	var domId = "#__mh_"+gaId;
	var $nextBookmark = $(domId).next();
	if($nextBookmark.hasClass("__mh_mid_train")) {//if it was next in a train, remove the class to make it the next head
		$nextBookmark.removeClass("__mh_mid_train");
		$nextBookmark.children().first().remove();
	}
	$(domId).remove();
}

function insertNavRow(gaId) {
  var n = new NavRow(bookmarkData);
}

function millisTill(datetime){
    return moment.unix(datetime).diff(moment());
}

function clearTimer(){
    if(timer){
        clearTimeout(timer);
        timer = undefined;
    }
}

function setTimer(toTime){
    clearTimer();
    timer = setTimeout(function(){
        updateBadge();
        if(isBookmarkContainerOpenend())
            doFullRebuild();
        else
            markForRebuild();
    },millisTill(toTime));
}


function clearNavRows(){
	$(".__mh_bookmark_container").empty();
 	lazyTrainManager = {};
}

function buildNavRows(){
	clearNavRows();
	var lst = bookmarkList();
	if(lst.length > 0){
		$.each(lst,function(i,e){addNavRow(e);});
        setTimer(lst[0].endTime);
    }
	else
		addBookmarkMenuItem("<div class='nav__row__summary__name __mh_no_bookmarks'>No bookmarks</div>",false,false,"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

}

function updateBadge($html){
    $html = $html || $(".__mh_bookmark_button");
	var doNotify = data.settings.get("Notify if Giveaways are about to end");
	var timespan = data.settings.get("Minutes before Ending");
	if(!doNotify){
		$html.find("a.nav__button .nav__notification").remove();
		return;
	}
    var lst = bookmarkList();
	var badgeNum = lst.filter(function(e){
		return moment.unix(e.endTime).isBetween(moment(), moment().add(timespan, "minutes"));
	}).length;
	if(badgeNum>0){
		$html.find("a.nav__button").append("<div class='nav__notification'>"+badgeNum+"</div>");
	}else{
		$html.find("a.nav__button .nav__notification").remove();
	}
    setTimer(lst[0].endTime);
}

function addNavButton(){
	var $html = $('<div class="nav__button-container nav__button-container--notification __mh_bookmark_button"> \
							<a class="nav__button"><i class="fa fa-bookmark"></i></a></div>');
	var $dropdown = $('<div class="nav__relative-dropdown ___mh_bookmark_outer_container is-hidden"><div class="nav__absolute-dropdown __mh_bookmark_container"></div></div>');
	$html.append($dropdown);
	$dropdown.insertAfter("header");

	updateBadge($html);
	$html.attr("title", "Bookmarked Giveaways");
	$html.on("click.bookmark",openBookmarkContainer);
	$(".nav__right-container").prepend($html);
	$(document).on("click.bookmark",":not(.___mh_bookmark_outer_container)",closeBookmarkContainer);
}

function toggleBookmarkCurrentPage(){
	toggleBookmark(/*SgApi.Util.*/getCurrentId());
	updateButtonState();
	updateBadge();
}

function amIBookmarked(){
	return isBookmarked(/*SgApi.Util.*/getCurrentId());
}

function isBookmarked(id){
	return data.bookmarks[id] !== undefined;
}
function updateButtonState(){
	var $faIcon = $(".__mh_bookmarked_icon");
	var isBookmarked = amIBookmarked();
	var css = "fa fa-bookmark" + (isBookmarked ? "" :"-o");
	var title = isBookmarked ? "Clear bookmark for this giveaway" : "Bookmark this Giveaway";
	$faIcon.removeClass("fa-bookmark fa-bookmark-o");
	$faIcon.addClass(css);
	$faIcon.attr("title",title);
}
function showButton(){
	var $ci =getContextInfoContainer();
	var $bookmarkBtn = $("<a><i class='__mh_bookmarked_icon'></i></a>");
	$bookmarkBtn.click(toggleBookmarkCurrentPage);
	$ci.append($bookmarkBtn);
	updateButtonState();
}
function getContextInfoContainer(){
	var ciClass="__mh_ci";
	var $ci = $("."+ciClass);
	if($ci.length===0){
		$ci = $("<span class='"+ciClass+"'></span>");
		$ci.insertAfter($(".featured__heading__small").last());
	}
	return $ci;
}

function readCurrentData(){
	var result = /*SgApi.*/Giveaways.currentGiveaway();
	delete result.descriptionHtml; //We dont want to save HTML in GM_storage that we dont need
	return /*SgApi.Util.*/unwrap(result);
}

function saveData(){
	 GM_setValue("__mh_bookmarks", data);
}

function clearBookmark(gaId){
   delete data.bookmarks[gaId];
   saveData();
}

function updateBookmark(entering) {
	queueBookmarkId(getCurrentId());
	Giveaways.loadGiveaway(getCurrentId(), function(ga){
			if(isBookmarked(getCurrentId())) {
					delete ga.descriptionHtml;
					ga = unwrap(ga);
					readBookmarks();
					if(entering) { ga.isEntered = true; }//assume success
					else { ga.isEntered = false; }
					saveBookmark(getCurrentId(), ga);
					try{
						enterNavRow(getCurrentId(),entering);
					}catch(e){
						console.error(e);
					}
				}
			unqueueBookmarkId(getCurrentId());
	});
}

function saveBookmark(gaId, bookmarkData){
	data.bookmarks[gaId] = bookmarkData;
	saveData();
}

function toggleBookmark(gaId){
	readBookmarks();
	if(isBookmarked(gaId)) {
		clearBookmark(gaId);
		removeNavRow(gaId);
		updateButtonState();
	} else {
        initGAClickHandlers();
		//For speed, save the current bookmark first and validate again later via AJAX
		saveBookmark(gaId, readCurrentData());
		markForRebuild();
		updateButtonState();
		queueBookmarkId(gaId);
		Giveaways.loadGiveaway(gaId, function(ga){
			if(isBookmarked(gaId)) {
				delete ga.descriptionHtml;
				ga = unwrap(ga);
				saveBookmark(gaId, ga);
				try{
					markForRebuild();
				}catch(e){
					console.error(e);
				}
			}
			unqueueBookmarkId(gaId);
		});
	}
}

function deleteEndedGAs(){
    Object.keys(data.bookmarks).forEach(function(key){
        var el = data.bookmarks[key];
        if(el.endTime*1000 < new Date().getTime())
            clearBookmark(el.id);
    });
}

function deleteEndedGAsSetting(){
    deleteEndedGAs();
    buildNavRows();
    updateBadge();   
}

function initSettings(){
    data.settings = new SgApi.Settings("SG Bookmarks")
        .boolean("Notify if Giveaways are about to end", true)
        .int("Minutes before Ending", 10, {minValue:1, editable: function(){return this.get("Notify if Giveaways are about to end");}})
        .boolean("Show giveaway status", true, {description:"Dim entered giveaways and color giveaways you cannot enter."})
		.boolean("Group giveaways in a train", true, {description:"Show which giveaways are in the same train."})
        .boolean("Remove ended Giveaways automatically", false, {description: "CAUTION! If you check this setting all your ended bookmarks are deleted immediately!"})
        .func("Clean up",deleteEndedGAsSetting, {description:"Delete all ended Giveaways from your bookmarks", faIcon:"fa-trash-o"})
        .init({instantSubmit:true});
    data.settings.on("save", function(){
        this.reload();
        buildNavRows();
        updateBadge();
    });

}

function readBookmarks(){
	data.bookmarks = GM_getValue("__mh_bookmarks", new Data()).bookmarks;
}

function bookmarkList(){
	var lst=[];
    if(data.settings.get("Remove ended Giveaways automatically"))
        deleteEndedGAs();
	for(var k in data.bookmarks){
		lst.push(data.bookmarks[k]);
	}
	lst.sort(function(a,b){
		var now = moment().unix();
		var adiff = now-a.endTime;
		var bdiff = now-b.endTime;
		var r1= a.endTime - b.endTime;
		if(adiff > 0 || bdiff > 0)
			return b.endTime-a.endTime;
		return bdiff -adiff;
	});
	return lst;
}

function getQueuedBookmarkIds() {
	return JSON.parse(GM_getValue("__mh_queuedBookmarkIds", "{}"));
}
function syncQueuedBookmarkIds() {
	$.each(queuedBookmarkIds,function(k,v) {
		if(current_queued_id_count < SYNC_QUEUED_MAX_CONCURRENT_IDS) {//Used to prevent too many concurrent AJAX calls which can occur from Sync All
			current_queued_id_count++;
			Giveaways.loadGiveaway(k, function(ga){
					if(isBookmarked(k)) {//GA should be bookmarked at any point in time. If it's not, it was already removed by the user; in that case, don't bother syncing.
						delete ga.descriptionHtml;
						ga = unwrap(ga);
						saveBookmark(k, ga);
						try{
							//buildNavRows();
							markForRebuild();
						}catch(e){
							console.error(e);
						}
						if(readCurrentData().id == ga.id) {//if on the page
							updateButtonState(); 
						}
					}
					unqueueBookmarkId(k);
				  current_queued_id_count--;
				  syncQueuedBookmarkIds();//call again in case there are any more that are blocked by the current_queued_id_count;
		 });
		} else { //break out if AJAX call limit is hit
			return false; 
		}
	});
}
function queueBookmarkId(gaId) {
	queuedBookmarkIds[gaId] = 1;
	GM_setValue("__mh_queuedBookmarkIds", JSON.stringify(queuedBookmarkIds));
}
function unqueueBookmarkId(gaId) {
	delete queuedBookmarkIds[gaId];
	GM_setValue("__mh_queuedBookmarkIds", JSON.stringify(queuedBookmarkIds));
}

function syncAllIfRequired() {
	var momentS = parseInt(moment().unix());
	if(momentS - lastSyncAllTimestamp >= SYNC_ALL_EXPIRY_PERIOD_S) {
		syncAllEnteredBookmarks();
	}
	//Putting the setVal here will mean that navigating away from the page too soon will disrupt the syncing. This is a design decision to prevent too many requests.
	GM_setValue("__mh_lastSyncAllTimestamp",momentS);
}
//Recursive
function syncAllEnteredBookmarks(enteredGiveawaysMap,page) {
	if(!enteredGiveawaysMap) {//If no params, start sync
		enteredGiveawaysMap = {};
		page = 1;
	}
	$.get( "https://www.steamgifts.com/giveaways/entered/search?page="+page, function( pageData ) {
		console.log("Syncing Entered GA page "+page);
		var dom = document.createElement('div');
		dom.innerHTML = pageData;
		var enteredGAsOnPage = dom.getElementsByClassName("table__remove-default is-clickable").length;
		var giveawayArr = dom.getElementsByClassName("global__image-outer-wrap global__image-outer-wrap--game-small");
		giveawayArr.length = enteredGAsOnPage;//truncate giveaways that are already expired
		for(var i=0;i<enteredGAsOnPage;i++){
			enteredGiveawaysMap[extractId(giveawayArr[i].href)] = 1;
		}
		if(enteredGAsOnPage >= 50) {//may have more, so navigate to next page
			syncAllEnteredBookmarks(enteredGiveawaysMap,++page);
		} else {//start sync
			readBookmarks();
			for(var k in data.bookmarks){
				if(enteredGiveawaysMap[k]) {
					data.bookmarks[k].isEntered = true;
				} else {
					if(data.bookmarks[k].isEntered) {//if was originally entered, it's maybe because the user now owns the game
						queueBookmarkId(k);//queue it for individual sync
					}
					data.bookmarks[k].isEntered = false;
				}
			}
			saveData();
			buildNavRows();
			syncQueuedBookmarkIds();
			console.log("Synced all bookmarks.");
		}
	});
}

function initGAClickHandlers() {
	if(!gaClickHandlersInitialized) {
		$("div.sidebar__entry-delete").click(function(){updateBookmark(false);});
		$("div.sidebar__entry-insert").click(function(){updateBookmark(true);});
		gaClickHandlersInitialized = true;
	}
}

function Data(){
	var that = this;
	this.bookmarks = {};
}

function NavRow(bookmarkData){
   this.title = bookmarkData.gameTitle;
   this.steamAppId = bookmarkData.steamAppId || bookmarkData.steamId;
   this.id = bookmarkData.id;
   this.url = buildGiveawayUrl(this.id);
   this.creator = bookmarkData.creator;
   this.ends = bookmarkData.endTime;
   this.cp = bookmarkData.cp;
   this.imgUrl = bookmarkData.thumbUrl || getGameThumbUrl(this.steamAppId);
   this.endsAt = moment.unix(this.ends);
   this.hasEnded = this.endsAt.isBefore(moment());
	 this.cpstr = " ("+this.cp+"P)";
	 if(this.title.length + this.cpstr.length > MAX_BOOKMARK_STR_LENGTH) {
		 this.title = this.title.substr(0,MAX_BOOKMARK_STR_LENGTH - this.cpstr.length) + "…";
	 }
   this.title = this.title+ this.cpstr;
   var endsStr = this.hasEnded ? "ended" : "ends";
   this.descr = "by "+this.creator+" - "+endsStr+" "+this.endsAt.fromNow();
   this.state = STATE_NOT_ENTERED;
	 if(bookmarkData.isEntered) { this.state = STATE_ENTERED; } 
	 else if(bookmarkData.isOwned) { this.state = STATE_OWNED; }
	 else if(bookmarkData.hasEnded) { this.state = STATE_ENDED; }
}

main();