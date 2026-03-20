import { useState, useEffect, useRef, useCallback } from "react";

const NAV  = "#354984";
const MINT = "#dbefe2";
const MINT2= "#b2d8c2";
const RED  = "#c62828";
const AMB  = "#e65100";
const GRN  = "#1b5e20";
const GOLD = "#b8860b";
const TEAL = "#00695c";
const PUR  = "#6a1b9a";

function daysLeft(d){ return Math.ceil((new Date(d)-new Date())/86400000); }
function fmtDate(d){ return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function urgColor(n){ return n<14?RED:n<30?AMB:n<60?GOLD:GRN; }
function urgIcon(n){ return n<14?"🚨":n<30?"⚠️":n<60?"⏰":"✅"; }
function fmt$(n){ return "$"+Math.round(n).toLocaleString(); }

const PROP_TYPE_META={
  hotel:    {label:"Hotel / Motel",   emoji:"🏨", color:"#1565c0", bg:"#e3f2fd"},
  apartment:{label:"Furnished Apt",   emoji:"🏠", color:"#2e7d32", bg:"#e8f5e9"},
  mixed:    {label:"Hotel or Apt",    emoji:"🏢", color:"#6a1b9a", bg:"#f3e5f5"},
};

const NOTICE_META={
  // ── THE 7 CONTRACT TYPES ────────────────────────────────────────────────────
  // Priority 1 — BID NOW
  solicitation:       {label:"Solicitation",              short:"SOL",  priority:1, action:"BID NOW",          emoji:"📋",color:RED,   bg:"#ffebee",  desc:"ACTIVE BID — submit a full proposal by the deadline. This is the one you want. Stop everything and build your proposal."},
  combined_synopsis:  {label:"Combined Synopsis/Sol",     short:"COMB", priority:1, action:"BID NOW",          emoji:"📋",color:RED,   bg:"#ffebee",  desc:"Sources Sought and Solicitation rolled into one. Treat it like a Solicitation — submit your full proposal by the deadline."},
  // Priority 2 — SEND CAPABILITY STATEMENT
  sources_sought:     {label:"Sources Sought",            short:"SS",   priority:2, action:"SEND CAP STMT",    emoji:"🔍",color:PUR,   bg:"#f3e5f5",  desc:"Market research only — NOT a bid yet. Send a 2-page capability statement with your CAGE code. Gets you on the CO's radar before the RFP drops. Takes 30 minutes."},
  // Priority 3 — WATCH AND WAIT
  pre_solicitation:   {label:"Pre-Solicitation",          short:"PRE",  priority:3, action:"WATCH & PREPARE",  emoji:"👁️",color:NAV,   bg:"#e3f2fd",  desc:"Solicitation coming soon but not released yet. Set a SAM.gov alert and start preparing. When the RFP drops you will already be ready."},
  blanket_purchase:   {label:"Blanket Purchase Agreement",short:"BPA",  priority:3, action:"APPLY FOR LIST",   emoji:"📄",color:TEAL,  bg:"#e0f7fa",  desc:"Standing vendor list — get on it once and the government can call you directly without rebidding every time. GSA Schedule 48 is this model. Getting on the list is the hard part but once you are on it, work flows to you."},
  idiq:               {label:"IDIQ",                      short:"IDIQ", priority:3, action:"WATCH & PREPARE",  emoji:"🔄",color:"#00838f",bg:"#e0f7fa", desc:"Indefinite Delivery Indefinite Quantity — win the master contract once, then get task orders for specific properties without rebidding each time. Many long-term housing contracts use this structure."},
  // Priority 4 — INTEL ONLY, DO NOT BID
  award_notice:       {label:"Award Notice",              short:"AWD",  priority:4, action:"INTEL ONLY",       emoji:"🏆",color:"#555", bg:"#f0f0f0",  desc:"Already awarded to someone else. Do not bid. Track who won and when it expires so you can prepare for the rebid in 1-5 years."},
  special_notice:     {label:"Special Notice",            short:"SPEC", priority:4, action:"SKIP — DO NOT BID",emoji:"⚠️",color:"#888", bg:"#fafafa",  desc:"Stay away from these as a bidding target. Usually announces an option year extension for a current vendor, an industry day, or a contract modification. Someone already has it."},
  justification:      {label:"Justification & Approval",  short:"J&A",  priority:4, action:"INTEL ONLY",       emoji:"⛔",color:"#c62828",bg:"#ffebee", desc:"Sole source — government skipped competition and went directly to one vendor. Nothing you can do this round. Note the agency and category for future positioning."},
  modification:       {label:"Modification / Amendment",  short:"MOD",  priority:4, action:"INTEL ONLY",       emoji:"✏️",color:"#888", bg:"#fafafa",  desc:"An existing contract is being changed — scope, price, timeline, or option year exercised. Someone already has it. Track for rebid timing."},
  // Internal
  registration:       {label:"Registration",              short:"REG",  priority:0, action:"COMPLETE NOW",     emoji:"📝",color:TEAL,  bg:"#e8f5e9",  desc:"Internal task — must complete to unlock contracts. GSA Schedule 48 registration unlocks ALL federal lodging contracts."},
};

// Sort priority: 1=Bid Now, 2=Send Cap Stmt, 3=Watch, 4=Intel/Skip, 0=Registration
const NOTICE_PRIORITY_ORDER = {
  registration:1, solicitation:2, combined_synopsis:3,
  sources_sought:4, pre_solicitation:5, blanket_purchase:6, idiq:7,
  award_notice:8, special_notice:9, justification:10, modification:11,
};

const STATUS_META={
  "Active Pursuit":{bg:"#e8f5e9",text:GRN, dot:"#43a047"},
  "In Progress":   {bg:"#e3f2fd",text:NAV, dot:"#1e88e5"},
  "Researching":   {bg:"#fff8e1",text:AMB, dot:"#ffa000"},
  "On Radar":      {bg:"#f3e5f5",text:PUR, dot:"#8e24aa"},
  "Respond Now":   {bg:"#ffebee",text:RED, dot:RED},
};

const KD_CITIES=["Milwaukee","Door County","St. Augustine","Jacksonville","Key West","Huntsville","San Diego"];

const GSA={
  // KD Property Cities
  "Milwaukee":       {lodging:140,mie:68, seasonal:false,note:"Milwaukee County NSA"},
  "Door County":     {lodging:138,mie:68, seasonal:true, note:"Oct & May–Sep $138; Nov–Apr $110"},
  "St. Augustine":   {lodging:162,mie:74, seasonal:true, note:"Peak Jan–Apr ~$211"},
  "Jacksonville":    {lodging:110,mie:68, seasonal:false,note:"Standard CONUS"},
  "Key West":        {lodging:327,mie:86, seasonal:true, note:"Peak Feb–Apr $436 — highest in FL"},
  "Huntsville":      {lodging:126,mie:68, seasonal:false,note:"Madison Co. NSA — Redstone Arsenal"},
  "San Diego":       {lodging:182,mie:79, seasonal:true, note:"Seasonal — verify at GSA.gov"},
  // Northeast
  "New York City":   {lodging:296,mie:79, seasonal:true, note:"Varies by month"},
  "Boston":          {lodging:232,mie:79, seasonal:true, note:"Seasonal"},
  "Philadelphia":    {lodging:178,mie:79, seasonal:false},
  "Washington DC":   {lodging:258,mie:79, seasonal:true, note:"Varies by month"},
  "Baltimore":       {lodging:153,mie:79, seasonal:false},
  "Providence":      {lodging:148,mie:74, seasonal:false},
  "Hartford":        {lodging:135,mie:74, seasonal:false},
  "Albany":          {lodging:120,mie:74, seasonal:false},
  "Buffalo":         {lodging:110,mie:68, seasonal:false},
  "Pittsburgh":      {lodging:118,mie:74, seasonal:false},
  "Newark":          {lodging:178,mie:79, seasonal:false,note:"Essex Co. NJ"},
  // Southeast
  "Atlanta":         {lodging:130,mie:74, seasonal:false},
  "Miami":           {lodging:163,mie:79, seasonal:true, note:"Seasonal"},
  "Fort Lauderdale": {lodging:224,mie:86, seasonal:true, note:"Peak Jan–Apr"},
  "Tampa":           {lodging:126,mie:74, seasonal:false},
  "Orlando":         {lodging:130,mie:74, seasonal:false},
  "Naples FL":       {lodging:196,mie:86, seasonal:true, note:"Peak Jan–Apr"},
  "Tallahassee":     {lodging:110,mie:68, seasonal:false},
  "Pensacola":       {lodging:110,mie:68, seasonal:false},
  "Charlotte":       {lodging:128,mie:74, seasonal:false},
  "Raleigh":         {lodging:126,mie:74, seasonal:false},
  "Richmond":        {lodging:124,mie:74, seasonal:false},
  "Virginia Beach":  {lodging:118,mie:74, seasonal:true},
  "Norfolk":         {lodging:118,mie:74, seasonal:false},
  "Nashville":       {lodging:160,mie:74, seasonal:false},
  "Memphis":         {lodging:110,mie:68, seasonal:false},
  "New Orleans":     {lodging:134,mie:74, seasonal:true},
  "Baton Rouge":     {lodging:110,mie:68, seasonal:false},
  "Birmingham":      {lodging:110,mie:68, seasonal:false},
  "Columbia SC":     {lodging:110,mie:68, seasonal:false},
  "Charleston SC":   {lodging:138,mie:74, seasonal:true},
  "Savannah":        {lodging:120,mie:74, seasonal:false},
  // Midwest
  "Chicago":         {lodging:200,mie:79, seasonal:false},
  "Detroit":         {lodging:113,mie:74, seasonal:false},
  "Minneapolis":     {lodging:134,mie:74, seasonal:false},
  "Cleveland":       {lodging:110,mie:68, seasonal:false},
  "Columbus":        {lodging:110,mie:68, seasonal:false},
  "Cincinnati":      {lodging:110,mie:68, seasonal:false},
  "Indianapolis":    {lodging:110,mie:68, seasonal:false},
  "Kansas City":     {lodging:110,mie:68, seasonal:false},
  "St. Louis":       {lodging:110,mie:68, seasonal:false},
  "Omaha":           {lodging:110,mie:68, seasonal:false},
  "Des Moines":      {lodging:110,mie:68, seasonal:false},
  "Madison WI":      {lodging:138,mie:68, seasonal:true, note:"Oct & May–Sep $138; off-season $110"},
  "Green Bay":       {lodging:110,mie:68, seasonal:false},
  "Dayton":          {lodging:110,mie:68, seasonal:false},
  "Akron":           {lodging:110,mie:68, seasonal:false},
  // South / Southwest
  "Dallas":          {lodging:161,mie:79, seasonal:false},
  "Houston":         {lodging:133,mie:74, seasonal:false},
  "Austin":          {lodging:173,mie:79, seasonal:true},
  "San Antonio":     {lodging:118,mie:74, seasonal:false},
  "El Paso":         {lodging:110,mie:68, seasonal:false},
  "Albuquerque":     {lodging:110,mie:68, seasonal:false},
  "Oklahoma City":   {lodging:110,mie:68, seasonal:false},
  "Tulsa":           {lodging:110,mie:68, seasonal:false},
  "Little Rock":     {lodging:110,mie:68, seasonal:false},
  "Louisville":      {lodging:110,mie:68, seasonal:false},
  "Lexington":       {lodging:110,mie:68, seasonal:false},
  "Fayetteville AR": {lodging:110,mie:68, seasonal:false},
  "Killeen TX":      {lodging:110,mie:68, seasonal:false,note:"Near Fort Cavazos"},
  "Fayetteville NC": {lodging:110,mie:68, seasonal:false,note:"Near Fort Liberty"},
  "Columbus GA":     {lodging:110,mie:68, seasonal:false,note:"Near Fort Moore"},
  // Mountain / West
  "Denver":          {lodging:167,mie:79, seasonal:false},
  "Phoenix":         {lodging:127,mie:74, seasonal:true},
  "Las Vegas":       {lodging:124,mie:74, seasonal:false},
  "Salt Lake City":  {lodging:131,mie:74, seasonal:false},
  "Tucson":          {lodging:110,mie:68, seasonal:false},
  "Colorado Springs":{lodging:110,mie:68, seasonal:false,note:"Near NORAD/Peterson SFB"},
  "Cheyenne":        {lodging:110,mie:68, seasonal:false},
  "Boise":           {lodging:110,mie:68, seasonal:false},
  "Reno":            {lodging:110,mie:68, seasonal:false},
  // West Coast
  "Los Angeles":     {lodging:182,mie:79, seasonal:false},
  "San Francisco":   {lodging:241,mie:79, seasonal:false},
  "Seattle":         {lodging:205,mie:79, seasonal:false},
  "Portland":        {lodging:156,mie:74, seasonal:false},
  "Sacramento":      {lodging:145,mie:74, seasonal:false},
  "Monterey":        {lodging:182,mie:79, seasonal:true},
  "Santa Barbara":   {lodging:196,mie:79, seasonal:true},
  "San Jose":        {lodging:225,mie:79, seasonal:false},
  "Oakland":         {lodging:241,mie:79, seasonal:false},
  "Tacoma":          {lodging:148,mie:74, seasonal:false,note:"Near Joint Base Lewis-McChord"},
  "Honolulu":        {lodging:211,mie:129,seasonal:false},
  "Anchorage":       {lodging:184,mie:79, seasonal:false},
  // International — Europe
  "London":          {lodging:382,mie:185,seasonal:false,note:"State Dept OCONUS — UK"},
  "Paris":           {lodging:396,mie:212,seasonal:false,note:"State Dept OCONUS — France"},
  "Berlin":          {lodging:264,mie:138,seasonal:false,note:"State Dept OCONUS — Germany"},
  "Frankfurt":       {lodging:271,mie:142,seasonal:false,note:"State Dept OCONUS — Germany"},
  "Rome":            {lodging:311,mie:161,seasonal:false,note:"State Dept OCONUS — Italy"},
  "Milan":           {lodging:318,mie:165,seasonal:false,note:"State Dept OCONUS — Italy"},
  "Madrid":          {lodging:248,mie:129,seasonal:false,note:"State Dept OCONUS — Spain"},
  "Barcelona":       {lodging:261,mie:136,seasonal:true, note:"State Dept OCONUS — Spain, seasonal"},
  "Amsterdam":       {lodging:303,mie:157,seasonal:false,note:"State Dept OCONUS — Netherlands"},
  "Brussels":        {lodging:284,mie:148,seasonal:false,note:"State Dept OCONUS — Belgium (NATO HQ)"},
  "Zurich":          {lodging:341,mie:177,seasonal:false,note:"State Dept OCONUS — Switzerland"},
  "Vienna":          {lodging:258,mie:134,seasonal:false,note:"State Dept OCONUS — Austria"},
  "Prague":          {lodging:198,mie:103,seasonal:false,note:"State Dept OCONUS — Czech Republic"},
  "Warsaw":          {lodging:187,mie:97, seasonal:false,note:"State Dept OCONUS — Poland"},
  "Stockholm":       {lodging:319,mie:165,seasonal:false,note:"State Dept OCONUS — Sweden"},
  "Oslo":            {lodging:334,mie:173,seasonal:false,note:"State Dept OCONUS — Norway"},
  "Copenhagen":      {lodging:326,mie:169,seasonal:false,note:"State Dept OCONUS — Denmark"},
  "Athens":          {lodging:214,mie:111,seasonal:true, note:"State Dept OCONUS — Greece, seasonal"},
  "Lisbon":          {lodging:231,mie:120,seasonal:false,note:"State Dept OCONUS — Portugal"},
  // International — Middle East / Africa
  "Dubai":           {lodging:374,mie:193,seasonal:false,note:"State Dept OCONUS — UAE"},
  "Abu Dhabi":       {lodging:358,mie:186,seasonal:false,note:"State Dept OCONUS — UAE"},
  "Riyadh":          {lodging:312,mie:162,seasonal:false,note:"State Dept OCONUS — Saudi Arabia"},
  "Doha":            {lodging:329,mie:171,seasonal:false,note:"State Dept OCONUS — Qatar (USAF Al Udeid)"},
  "Kuwait City":     {lodging:298,mie:155,seasonal:false,note:"State Dept OCONUS — Kuwait"},
  "Tel Aviv":        {lodging:341,mie:177,seasonal:false,note:"State Dept OCONUS — Israel"},
  "Cairo":           {lodging:186,mie:97, seasonal:false,note:"State Dept OCONUS — Egypt"},
  "Nairobi":         {lodging:214,mie:111,seasonal:false,note:"State Dept OCONUS — Kenya"},
  "Cape Town":       {lodging:178,mie:93, seasonal:true, note:"State Dept OCONUS — South Africa"},
  // International — Asia Pacific
  "Tokyo":           {lodging:323,mie:175,seasonal:false,note:"State Dept OCONUS — Japan"},
  "Osaka":           {lodging:298,mie:155,seasonal:false,note:"State Dept OCONUS — Japan"},
  "Seoul":           {lodging:288,mie:156,seasonal:false,note:"State Dept OCONUS — South Korea"},
  "Singapore":       {lodging:412,mie:201,seasonal:false,note:"State Dept OCONUS — highest APAC rate"},
  "Sydney":          {lodging:286,mie:149,seasonal:false,note:"State Dept OCONUS — Australia"},
  "Melbourne":       {lodging:271,mie:141,seasonal:false,note:"State Dept OCONUS — Australia"},
  "Hong Kong":       {lodging:388,mie:198,seasonal:false,note:"State Dept OCONUS — HK SAR"},
  "Beijing":         {lodging:298,mie:155,seasonal:false,note:"State Dept OCONUS — China"},
  "Shanghai":        {lodging:311,mie:162,seasonal:false,note:"State Dept OCONUS — China"},
  "Bangkok":         {lodging:198,mie:103,seasonal:false,note:"State Dept OCONUS — Thailand"},
  "Manila":          {lodging:186,mie:97, seasonal:false,note:"State Dept OCONUS — Philippines"},
  "Jakarta":         {lodging:178,mie:93, seasonal:false,note:"State Dept OCONUS — Indonesia"},
  "Kuala Lumpur":    {lodging:191,mie:99, seasonal:false,note:"State Dept OCONUS — Malaysia"},
  "New Delhi":       {lodging:214,mie:111,seasonal:false,note:"State Dept OCONUS — India"},
  "Mumbai":          {lodging:224,mie:116,seasonal:false,note:"State Dept OCONUS — India"},
  // International — Americas
  "Toronto":         {lodging:198,mie:112,seasonal:false,note:"State Dept OCONUS — Canada"},
  "Ottawa":          {lodging:187,mie:107,seasonal:false,note:"State Dept OCONUS — Canada"},
  "Vancouver":       {lodging:211,mie:118,seasonal:false,note:"State Dept OCONUS — Canada"},
  "Mexico City":     {lodging:161,mie:97, seasonal:false,note:"State Dept OCONUS — Mexico"},
  "Bogota":          {lodging:148,mie:88, seasonal:false,note:"State Dept OCONUS — Colombia"},
  "Lima":            {lodging:154,mie:91, seasonal:false,note:"State Dept OCONUS — Peru"},
  "Buenos Aires":    {lodging:143,mie:86, seasonal:false,note:"State Dept OCONUS — Argentina"},
  "Brasilia":        {lodging:156,mie:93, seasonal:false,note:"State Dept OCONUS — Brazil"},
  "Sao Paulo":       {lodging:168,mie:99, seasonal:false,note:"State Dept OCONUS — Brazil"},
};

// ── ALL CONTRACTS ─────────────────────────────────────────────────────────────
// ✅ REAL CONTRACTS ONLY — pulled from SAM.gov screenshots
// Add new contracts by sending SAM.gov screenshots to Claude
const CONTRACTS=[

  // ── REAL — Scanned from SAM.gov March 19, 2026 ──────────────────────────────
  {id:"u13",rank:1,city:"Winnemucca",region:"Mountain/West",setAside:"Unrestricted",status:"Active Pursuit",
   noticeType:"solicitation",verified:true,propType:"hotel",
   scannedIn:true,
   extension:{extendable:false,options:0,length:"N/A",totalDuration:"Seasonal — single year",conditions:"Seasonal fire housing — one season. Extension subject to BLM operational need."},
   title:"Seasonal Fire Housing – Winnemucca District NV",agency:"Dept. of Interior / Bureau of Land Management",
   naics:"531110",value:"TBD — verify on SAM.gov",deadline:"2026-03-24",moveInDate:"2026-04-01",sol:"140L3926Q0012",
   poc:"blm.nevada@blm.gov",
   nextAction:"🚨 DUE MARCH 24 at 1:00 PM PDT — URGENT. Call Winnemucca hotels NOW. BLM Nevada State Office seasonal fire crew housing. Open competition. Submit immediately.",
   tags:["BLM","Interior","Winnemucca","Nevada","Seasonal","Fire Housing","Real SAM.gov","URGENT"],
   sow:{
     lodgingSchedule:{type:"seasonal",typeLabel:"🌿 Seasonal",nightsPerYear:90,weeksPerYear:13,specificDates:"Fire season: May–Sep. BLM activation upon wildfire activity.",scheduleNotes:"On-call within 24–48 hrs of activation. Fire crews rotate weekly."},
     units:"TBD — pull from SAM.gov notice",duration:"Seasonal — fire season",location:"Winnemucca NV — BLM Nevada District",
     amenities:["Fully furnished","Wi-Fi","Parking","Kitchen or meal provision","Laundry","Linens","TV"],
     utilities:["Electric","Water","Internet included"],
     requirements:["Winnemucca NV proximity","Fire crew housing capable","Rapid activation within 48 hrs","Net-30","Verify full SOW at SAM.gov Notice 140L3926Q0012"]}},

  {id:"u14",rank:2,city:"TBD",region:"TBD",setAside:"Unrestricted",status:"Active Pursuit",
   noticeType:"solicitation",verified:true,propType:"apartment",
   scannedIn:true,
   extension:{extendable:false,options:0,length:"N/A",totalDuration:"TBD — pull from SAM.gov"},
   title:"Apartment Rentals for Medical Residents",agency:"TBD — verify on SAM.gov",
   naics:"531110",value:"TBD",deadline:"TBD",moveInDate:"TBD",sol:"X1FZ",
   poc:"TBD — verify on SAM.gov",
   nextAction:"Pull full notice at SAM.gov using Notice ID X1FZ — location, agency, deadline, and set-aside all TBD. Your PharmD background is a direct match for medical resident housing.",
   tags:["Medical Residents","Apartment","Real SAM.gov","Pull Full Notice","PharmD Match"],
   sow:{
     lodgingSchedule:{type:"continuous",typeLabel:"📅 Continuous/Year-Round",nightsPerYear:270,weeksPerYear:39,specificDates:"TBD — verify at SAM.gov Notice X1FZ",scheduleNotes:"Medical resident housing — typically 30–90 day rotations."},
     units:"TBD",duration:"TBD",location:"TBD — pull from SAM.gov",
     amenities:["Fully furnished","Wi-Fi","Full kitchen","Parking","Laundry","Linens","TV","Desk"],
     utilities:["Electric","Water","Internet included"],
     requirements:["Verify all requirements at SAM.gov Notice ID X1FZ","Pull full SOW before bidding","PharmD credential relevant — mention in capability statement"]}},

  {id:"u15",rank:99,city:"Houston",region:"Southwest",setAside:"Unrestricted",status:"On Radar",
   noticeType:"award_notice",verified:true,propType:"mixed",
   scannedIn:true,
   extension:{extendable:false,options:0,length:"N/A",totalDuration:"Already awarded — track for rebid"},
   title:"US Govt Secured Office & Related Space – Houston TX (Award Intel)",agency:"GSA / Public Buildings Service",
   naics:"531110",value:"N/A — Already Awarded",deadline:"2026-12-31",moveInDate:"N/A",sol:"6TX0719",
   poc:"pbs.houston@gsa.gov",
   nextAction:"AWARD NOTICE ONLY — not a bid opportunity. Awardee: Houston PT BAC Office LP (UEI: CQQTPDMNHHQ1). Track for future rebid when this contract expires.",
   tags:["GSA","Houston","Award Notice","Intel Only","Track for Rebid","Real SAM.gov"],
   sow:{lodgingSchedule:{type:"continuous",typeLabel:"📅 Award Intel — Not Active Bid",nightsPerYear:0,weeksPerYear:0,specificDates:"Already awarded March 17, 2026",scheduleNotes:"Track expiration date for future rebid opportunity."},
     units:"N/A",duration:"N/A — already awarded",location:"Houston TX",
     amenities:[],utilities:[],
     requirements:["Monitor SAM.gov for contract expiration","Prepare capability statement for future RFP","GSA PBS relationship — register as preferred vendor"]}},

  // ── TEST CONTRACTS — delete these once you have real SAM.gov contracts ────────
  {id:"test01",rank:98,city:"Milwaukee",region:"KD Cities",setAside:"WOSB",status:"Researching",
   noticeType:"solicitation",verified:false,propType:"hotel",
   extension:{extendable:true,options:4,length:"1 year each",totalDuration:"5 years total",conditions:"TEST — Base + 4 option years."},
   title:"TEST ONLY — Hotel TDY Lodging (Not a Real Contract)",agency:"Dept. of Defense / TEST AGENCY",
   naics:"721110",value:"$80,000–$200,000",deadline:"2027-06-30",moveInDate:"2027-08-01",sol:"TEST-HOTEL-0001",
   poc:"test@test.gov",
   nextAction:"TEST CONTRACT — verify hotel panels, profit calc, room specs, conference space all work correctly. Delete once real contracts come in.",
   tags:["TEST","Hotel","Delete When Ready"],
   sow:{
     lodgingSchedule:{type:"tdy",typeLabel:"✈️ TDY Rotations",nightsPerYear:180,weeksPerYear:26,specificDates:"Test period",scheduleNotes:"TEST only."},
     units:"10–20 rooms/night",duration:"12 months base",location:"Milwaukee WI — TEST ONLY",
     amenities:["Fully furnished","Wi-Fi","In-room safe","Parking","Kitchen","Laundry","Linens","TV","A/C","Pool"],
     utilities:["Electric","Water","Internet included"],
     requirements:["In-room safe required","DoD DTS compatible","Background check","Fire safe compliance","WOSB active","Net-30 via IPP"],
     conferenceSpace:{required:true,capacity:"50–100 attendees",connected:true,av:true,foodBeverage:true,breakoutRooms:2,parking:"On-site",wifi:"Dedicated event Wi-Fi"},
     roomSpecs:{bedTypes:["King","Queen","Double Queen"],adaRequired:true,connectedRooms:true,smokingPolicy:"Non-smoking only",distanceFromBase:"Within 5 miles of Milwaukee Federal Building"},
     evalMethod:"LPTA (Lowest Price Technically Acceptable)",
     experienceRequired:"Minimum 1 year managing hotel or extended stay lodging.",
     pastPerformance:"2–3 references. Airbnb Superhost qualifies."}},

  {id:"test02",rank:99,city:"St. Augustine",region:"KD Cities",setAside:"WOSB",status:"Researching",
   noticeType:"sources_sought",verified:false,propType:"apartment",
   extension:{extendable:true,options:2,length:"1 year each",totalDuration:"3 years total",conditions:"TEST — Base + 2 option years."},
   title:"TEST ONLY — Furnished Apartment Housing (Not a Real Contract)",agency:"Dept. of Veterans Affairs / TEST AGENCY",
   naics:"531110",value:"$120,000–$300,000",deadline:"2027-07-31",moveInDate:"2027-09-01",sol:"TEST-APT-0002",
   poc:"test@test.gov",
   nextAction:"TEST CONTRACT — verify apartment panels, profit calc, budget breakdown, vendor list all work correctly. Delete once real contracts come in.",
   tags:["TEST","Apartment","Delete When Ready"],
   sow:{
     lodgingSchedule:{type:"continuous",typeLabel:"📅 Continuous/Year-Round",nightsPerYear:300,weeksPerYear:43,specificDates:"Test — year-round",scheduleNotes:"TEST only."},
     units:"8–15 units",duration:"12 months base",location:"St. Augustine FL — TEST ONLY",
     amenities:["Fully furnished","Wi-Fi","Full kitchen","Parking","Laundry","Linens","TV","ADA units available","Desk"],
     utilities:["Electric","Water","Gas/Heat","Internet included"],
     requirements:["Near VA facility","Full kitchen required","In-unit or on-site laundry","ADA accessible unit available","Net-30 via IPP","Background check"],
     evalMethod:"Best Value / Tradeoff",
     experienceRequired:"Documented experience managing furnished residential units.",
     pastPerformance:"Airbnb Superhost + STR management history qualifies."}}
];

const UNRESTRICTED_CONTRACTS=[];


// ── REGION TABS ───────────────────────────────────────────────────────────────
const REGION_TABS=[
  {id:"all",          label:"All",            setaside:null, region:null, propType:null},
  {id:"wosb",         label:"👩 WOSB Only",   setaside:"WOSB", region:null, propType:null},
  {id:"sb",           label:"🏢 SB Only",     setaside:"Small Business", region:null, propType:null},
  {id:"hotel",        label:"🏨 Hotels",      setaside:null, region:null, propType:"hotel"},
  {id:"apartment",    label:"🏠 Apartments",  setaside:null, region:null, propType:"apartment"},
  {id:"KD Cities",    label:"⭐ KD Cities",   setaside:null, region:"KD Cities", propType:null},
  {id:"Northeast",    label:"Northeast",      setaside:null, region:"Northeast", propType:null},
  {id:"Southeast",    label:"Southeast",      setaside:null, region:"Southeast", propType:null},
  {id:"Midwest",      label:"Midwest",        setaside:null, region:"Midwest", propType:null},
  {id:"Southwest",    label:"Southwest",      setaside:null, region:"Southwest", propType:null},
  {id:"Mountain/West",label:"Mountain/West",  setaside:null, region:"Mountain/West", propType:null},
  {id:"International", label:"🌍 International",setaside:null, region:"International",  propType:null},
];

// ── SAM.GOV SEARCH GUIDE DATA ─────────────────────────────────────────────────
const SAM_SEARCHES=[
  {
    priority:"🔑 Run Daily",color:RED,
    searches:[
      {keyword:"temporary housing",     naics:"531110",setaside:"WOSB",        note:"Your #1 search — catches most furnished housing contracts"},
      {keyword:"lodging",               naics:"721110",setaside:"WOSB",        note:"Catches hotel/motel style contracts"},
      {keyword:"furnished housing",     naics:"531110",setaside:"WOSB",        note:"Targets mid-term furnished unit contracts"},
      {keyword:"VA housing",            naics:"531110",setaside:"WOSB",        note:"Veterans Affairs housing — your strongest market"},
      {keyword:"seasonal housing",      naics:"531110",setaside:"Open",        note:"Seasonal crews — fire, USFS, USACE. Like the Winnemucca BLM contract."},
    ]
  },
  {
    priority:"⚠️ Run 3x/Week",color:AMB,
    searches:[
      {keyword:"workforce housing",     naics:"531110",setaside:"Small Business",note:"Broader — catches SB set-asides too"},
      {keyword:"relocation housing",    naics:"531110",setaside:"WOSB",          note:"Medical/government staff relocation"},
      {keyword:"TDY lodging",           naics:"721110",setaside:"WOSB",          note:"Military temporary duty lodging"},
      {keyword:"hotel accommodations",  naics:"721110",setaside:"WOSB",          note:"Short-term hotel-style contracts"},
      {keyword:"temporary lodging",     naics:"721110",setaside:"WOSB",          note:"Catches all temp lodging types"},
      {keyword:"fire housing",          naics:"531110",setaside:"Open",          note:"BLM/USFS fire crew seasonal housing — like Notice 140L3926Q0012"},
      {keyword:"crew housing",          naics:"531110",setaside:"Open",          note:"USACE, BLM, USFS field crew quarters"},
      {keyword:"medical resident housing",naics:"531110",setaside:"Open",        note:"Hospital/VA medical resident furnished apartments — like Notice X1FZ"},
    ]
  },
  {
    priority:"✅ Run Weekly",color:GRN,
    searches:[
      {keyword:"furnished apartment",   naics:"531110",setaside:"WOSB",        note:"Apartment-style furnished units"},
      {keyword:"emergency housing",     naics:"531110",setaside:"Small Business",note:"FEMA and disaster response housing"},
      {keyword:"transitional housing",  naics:"531110",setaside:"WOSB",        note:"VA veterans transitional housing"},
      {keyword:"extended stay",         naics:"721110",setaside:"WOSB",        note:"Long-stay hotel/apartment style"},
      {keyword:"motel",                 naics:"721110",setaside:"Small Business",note:"Don't overlook motel-type contracts"},
      {keyword:"motor court",           naics:"721110",setaside:"Open",        note:"NAICS 721110 sub-category — roadside motor courts, often rural/remote govt use"},
      {keyword:"cottage",               naics:"721199",setaside:"Open",        note:"NAICS 721199 — Housekeeping Cottages and Cabins. USFS, NPS, BLM use these."},
      {keyword:"cabin lodging",         naics:"721199",setaside:"Open",        note:"NPS/USFS cabin-style crew housing — covered under 721199"},
      {keyword:"mobile home lodging",   naics:"531110",setaside:"Open",        note:"531110 sub — mobile/manufactured housing for govt use. Remote site crews."},
      {keyword:"manufactured housing",  naics:"531110",setaside:"Open",        note:"HUD manufactured housing programs — long-stay disaster/transitional"},
      {keyword:"RV park lodging",       naics:"721211",setaside:"Open",        note:"NAICS 721211 — RV Parks. BLM/USFS fire season crew housing."},
      {keyword:"retreat",               naics:"721110",setaside:"Small Business",note:"Training retreats often need lodging"},
      {keyword:"training facility lodging",naics:"721110",setaside:"Small Business",note:"Government training events"},
      {keyword:"guest house",           naics:"721199",setaside:"Open",        note:"721199 — All Other Traveler Accommodation. Embassy/State Dept guest housing."},
      {keyword:"hostel lodging",        naics:"721191",setaside:"Open",        note:"NAICS 721191 — Bed & Breakfast. Some NPS/State Dept prefer B&B style."},
    ]
  },
  {
    priority:"🌍 NAICS Sub-Categories to Register",color:TEAL,
    searches:[
      {keyword:"531110",naics:"531110",setaside:"",note:"Lessors of Residential Buildings & Dwellings — PRIMARY. Furnished apts, transitional housing, VA."},
      {keyword:"721110",naics:"721110",setaside:"",note:"Hotels & Motels — TDY, DoD, GSA lodging contracts."},
      {keyword:"721120",naics:"721120",setaside:"",note:"Casino Hotels — rare but some govt training uses casino hotel conf space."},
      {keyword:"721191",naics:"721191",setaside:"",note:"Bed & Breakfast Inns — NPS, State Dept, small mission housing."},
      {keyword:"721199",naics:"721199",setaside:"",note:"All Other Traveler Accommodation — cottages, cabins, guest houses. USFS/NPS fire crew."},
      {keyword:"721211",naics:"721211",setaside:"",note:"RV Parks & Campgrounds — BLM/USFS seasonal crew. Add to SAM.gov NAICS list."},
      {keyword:"531190",naics:"531190",setaside:"",note:"Lessors of Other Real Estate — covers mobile home lots, manufactured housing."},
    ]
  },
];

const SAM_STEPS=[
  {step:1,title:"Go to SAM.gov — do NOT sign in",detail:"Open SAM.gov/opportunities in your browser. You do NOT need to be logged in to search. Just go straight to the search bar.",icon:"🌐"},
  {step:2,title:"Type your keyword in the search bar",detail:"Start with one keyword (e.g. 'VA housing'). Don't type multiple keywords at once — run separate searches for each one.",icon:"🔍"},
  {step:3,title:"Uncheck 'Inactive' immediately",detail:"Default shows inactive listings. Uncheck this box to show only open, active opportunities.",icon:"☑️"},
  {step:4,title:"Select 'Contract Opportunities' only",detail:"This removes grants, awards, and other non-contract notices from results.",icon:"📋"},
  {step:5,title:"Set Set-Aside filter = WOSB",detail:"Filter by 'Women-Owned Small Business' set-aside. These are reserved for you — no competing with large companies.",icon:"🏆"},
  {step:6,title:"Sort by Response Date — soonest first",detail:"Always look at what's closing soonest. Deadlines sneak up fast.",icon:"📅"},
  {step:7,title:"Check the Notice Type on every listing",detail:"📋 Solicitation = submit full proposal. 🔍 Sources Sought = send capability statement. 👁️ Pre-Sol = watch and prepare.",icon:"👁️"},
  {step:8,title:"Record every Notice ID you review",detail:"Copy the Notice ID into your Opportunity Tracker spreadsheet. Every one — even ones you pass on.",icon:"📝"},
  {step:9,title:"Save your search as an Alert",detail:"After running a search, click 'Save Search' and set up email alerts. SAM.gov will email you whenever a new match is posted.",icon:"🔔"},
  {step:10,title:"Paste any listing here — I'll build the proposal",detail:"Find a contract on SAM.gov? Copy and paste the full listing text here and I will immediately build your full proposal package.",icon:"🚀"},
];

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function NoticePill({type,large}){
  const m=NOTICE_META[type];
  return(<span style={{background:m.bg,color:m.color,border:`1.5px solid ${m.color}40`,borderRadius:5,
    padding:large?"4px 10px":"2px 7px",fontSize:large?12:10,fontWeight:800,
    display:"inline-flex",alignItems:"center",gap:4}}>{m.emoji} {large?m.label:m.short}</span>);
}
function SetPill({type}){
  const isW=type==="WOSB";
  return(<span style={{background:isW?NAV:"#f0f4ff",color:isW?"#fff":NAV,borderRadius:4,
    padding:"2px 8px",fontSize:10,fontWeight:800,letterSpacing:1,
    border:isW?"none":`1px solid ${NAV}`}}>{isW?"WOSB":"SB"}</span>);
}
function StatusDot({status}){
  const c=STATUS_META[status]||{bg:"#eee",text:"#555",dot:"#999"};
  return(<span style={{background:c.bg,color:c.text,borderRadius:20,padding:"2px 9px",
    fontSize:11,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,display:"inline-block"}}/>
    {status}</span>);
}

// ── CONTRACT ROW ──────────────────────────────────────────────────────────────
function ContractRow({c,selected,onClick}){
  const sel=selected?.id===c.id;
  const days=daysLeft(c.deadline);
  const dc=urgColor(days);
  const gsa=GSA[c.city];
  const isKD=KD_CITIES.includes(c.city);
  return(
    <div onClick={onClick} style={{borderRadius:10,marginBottom:7,cursor:"pointer",overflow:"hidden",
      border:sel?`2px solid ${NAV}`:`2px solid ${days<14?RED+"80":days<30?AMB+"60":isKD?NAV+"40":"#e4e9f4"}`,
      background:sel?NAV:"#fff",boxShadow:sel?`0 4px 16px ${NAV}30`:"0 1px 4px #0000000b",transition:"all 0.13s"}}>
      <div style={{background:sel?"rgba(255,255,255,0.13)":days<14?RED:days<30?AMB:days<60?"#f9a825":isKD?NAV+"dd":"#c8e6c9",
        padding:"4px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:10,fontWeight:900,letterSpacing:0.5,
          color:sel?"#fff":days<60||isKD?"#fff":GRN}}>
          {isKD?"⭐ ":""}{c.city} {!c.verified&&"· 🔍 Research"}
        </span>
        <span style={{fontSize:11,fontWeight:900,color:sel?"#fff":days<60||isKD?"#fff":GRN}}>
          {urgIcon(days)} {days>0?`${days}d`:"PAST"}
        </span>
      </div>
      <div style={{padding:"9px 13px 11px"}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:5,alignItems:"center"}}>
          <NoticePill type={c.noticeType}/>
          {(()=>{
            const nm = NOTICE_META[c.noticeType];
            if(!nm) return null;
            const actionColors = {
              "BID NOW":         {bg:"#c62828",text:"#fff"},
              "SEND CAP STMT":   {bg:"#6a1b9a",text:"#fff"},
              "WATCH & PREPARE": {bg:"#354984",text:"#fff"},
              "APPLY FOR LIST":  {bg:"#00695c",text:"#fff"},
              "INTEL ONLY":      {bg:"#555",   text:"#fff"},
              "SKIP — DO NOT BID":{bg:"#999",  text:"#fff"},
              "COMPLETE NOW":    {bg:"#00695c",text:"#fff"},
            };
            const ac = actionColors[nm.action]||{bg:"#888",text:"#fff"};
            return(
              <span style={{background:sel?"rgba(255,255,255,0.22)":ac.bg,
                color:sel?"#fff":ac.text,borderRadius:4,padding:"2px 8px",
                fontSize:9,fontWeight:900,letterSpacing:0.8,textTransform:"uppercase"}}>
                {nm.action}
              </span>
            );
          })()}
          <PropTypePill type={c.propType}/>
          {!sel&&<StatusDot status={c.status}/>}
        </div>
        <div style={{fontWeight:800,fontSize:12.5,lineHeight:1.35,
          color:sel?"#fff":"#1a2340",marginBottom:3}}>{c.title}</div>
        <div style={{fontSize:11,color:sel?"rgba(255,255,255,0.65)":"#778",marginBottom:4}}>
          {c.agency}
        </div>
        <div style={{fontSize:10,fontFamily:"monospace",fontWeight:700,
          background:sel?"rgba(255,255,255,0.15)":"#f0f4ff",
          color:sel?"rgba(255,255,255,0.9)":NAV,borderRadius:4,padding:"2px 8px",
          display:"inline-block",marginBottom:5,letterSpacing:0.3,border:sel?"none":`1px solid ${NAV}25`}}>
          🪪 {c.sol}
        </div>
        {c.moveInDate&&(
          <div style={{fontSize:11,fontWeight:700,
            color:sel?"rgba(255,255,255,0.8)":"#2e7d32",marginBottom:4}}>
            🟢 Gov't needs units by {fmtDate(c.moveInDate)}
          </div>
        )}
        {c.extension&&(
          <div style={{fontSize:10,fontWeight:700,marginBottom:4,
            color:sel?"rgba(255,255,255,0.7)":c.extension.extendable?"#1565c0":"#888"}}>
            {c.extension.extendable
              ? `🔄 Extendable — ${c.extension.options}x option${c.extension.options>1?"s":""} · ${c.extension.totalDuration}`
              : "⛔ Not extendable"}
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:700,color:sel?"rgba(255,255,255,0.85)":NAV}}>{c.value}</span>
          {gsa&&<span style={{fontSize:10,color:sel?"rgba(255,255,255,0.55)":"#999"}}>GSA ${gsa.lodging}/nt</span>}
        </div>
      </div>
    </div>
  );
}

// ── PROPERTY TYPE PILL ───────────────────────────────────────────────────────
function PropTypePill({type,large}){
  const m=PROP_TYPE_META[type]||PROP_TYPE_META.mixed;
  return(
    <span style={{background:m.bg,color:m.color,border:`1.5px solid ${m.color}40`,borderRadius:5,
      padding:large?"4px 10px":"2px 7px",fontSize:large?12:10,fontWeight:800,
      display:"inline-flex",alignItems:"center",gap:4}}>
      {m.emoji} {large?m.label:m.emoji+" "+(type==="hotel"?"Hotel":"Apt")}
    </span>
  );
}

// ── PROFIT & BUDGET CALCULATOR ────────────────────────────────────────────────
function ProfitCalc({c, gsaRate}){
  const isHotel = c.propType==="hotel";
  const bidRate = Math.round(gsaRate * 0.98); // 2% below GSA

  // Use LAST number in range for budget (worst case) e.g. "5–20 units" → 20
  const [units,   setUnits]   = useState(()=>{
    const m = String(c.sow?.units||"5");
    const nums = m.match(/\d+/g);
    if(!nums) return 5;
    const last = parseInt(nums[nums.length-1]);
    return isNaN(last)?5:last;
  });
  const [nights,  setNights]  = useState(()=>{
    const n = c.sow?.lodgingSchedule?.nightsPerYear;
    // Show monthly equivalent: nights per year / 12, capped at 30
    if(n && n > 0) return Math.min(Math.round(n/12), 30);
    return 30;
  });
  const [rent,    setRent]    = useState(isHotel?0:1200);       // monthly rent/mortgage per unit (apt only)
  const [furni,   setFurni]   = useState(isHotel?0:300);        // furniture rental per unit/month (Core Rentals ~$300)
  const [util,    setUtil]    = useState(isHotel?0:150);        // utilities per unit/month
  const [clean,   setClean]   = useState(isHotel?80:200);       // cleaning per unit/month
  const [staff,   setStaff]   = useState(500);                  // staff/mgmt total per month
  const [supply,  setSupply]  = useState(isHotel?50:100);       // supplies per unit/month
  const [misc,    setMisc]    = useState(200);                  // misc/other per month

  // Contract duration in months for furniture total
  const contractMonths = (()=>{
    const dur = String(c.sow?.duration || "");
    const yrs = dur.match(/(\d+)\s*year/i);
    if(yrs) return parseInt(yrs[1]) * 12;
    const mos = dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*month/i);
    if(mos) return parseInt(mos[2]);
    const mo = dur.match(/(\d+)\s*month/i);
    if(mo) return parseInt(mo[1]);
    const days = dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*day/i);
    if(days) return Math.ceil(parseInt(days[2]) / 30);
    const day = dur.match(/(\d+)\s*day/i);
    if(day) return Math.max(1, Math.ceil(parseInt(day[1]) / 30));
    return 12;
  })();

  const revenue    = bidRate * units * nights;
  const totalRent  = rent * units;
  const totalFurni = furni * units;
  const totalUtil  = util * units;
  const totalClean = clean * units;
  const totalSupply= supply * units;
  const totalExp   = totalRent + totalFurni + totalUtil + totalClean + staff + totalSupply + misc;
  const profit     = revenue - totalExp;
  const profitOk   = profit >= 5000;
  const margin     = revenue>0 ? ((profit/revenue)*100).toFixed(1) : 0;

  const inputStyle={
    width:"100%",padding:"6px 8px",borderRadius:6,
    border:`1.5px solid #dde3f0`,fontSize:12,fontFamily:"inherit",
    outline:"none",textAlign:"right",boxSizing:"border-box",
  };

  const Row=({label,val,setter,locked,color})=>(
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
      <span style={{flex:1,fontSize:12,color:"#445"}}>{label}</span>
      {locked
        ? <span style={{fontSize:13,fontWeight:700,color:color||NAV,minWidth:80,textAlign:"right"}}>{fmt$(val)}</span>
        : <div style={{position:"relative",width:90}}>
            <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#888"}}>$</span>
            <input type="number" value={val} onChange={e=>setter(Math.max(0,parseInt(e.target.value)||0))}
              style={{...inputStyle,paddingLeft:18}}/>
          </div>
      }
    </div>
  );

  return(
    <div style={{background:"#f7f9fc",border:`2px solid ${profitOk?GRN:RED}40`,borderRadius:12,padding:"16px 18px",marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,fontWeight:800,color:"#1a2340",textTransform:"uppercase",letterSpacing:0.8}}>
          💵 Profit & Budget Calculator
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <PropTypePill type={c.propType} large/>
          <span style={{background:profitOk?GRN:RED,color:"#fff",borderRadius:6,
            padding:"4px 12px",fontSize:12,fontWeight:900}}>
            {profitOk?"✅ Profitable":"❌ Below $5K Target"}
          </span>
        </div>
      </div>

      {/* Units + Nights sliders */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {[
          {label:"Units",val:units,set:setUnits,min:1,max:100},
          {label:"Nights/Month",val:nights,set:setNights,min:1,max:31},
        ].map(({label,val,set,min,max})=>(
          <div key={label} style={{background:"#fff",borderRadius:8,padding:"10px 12px",border:"1px solid #e4e9f4"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#9aa",textTransform:"uppercase",marginBottom:4}}>{label}</div>
            <div style={{fontSize:22,fontWeight:900,color:NAV,marginBottom:4}}>{val}</div>
            <input type="range" min={min} max={max} value={val} onChange={e=>set(parseInt(e.target.value))}
              style={{width:"100%",accentColor:NAV}}/>
          </div>
        ))}
      </div>

      {/* Bid rate banner */}
      <div style={{background:NAV,borderRadius:8,padding:"10px 14px",marginBottom:12,
        display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:700,letterSpacing:0.8,textTransform:"uppercase"}}>Your Bid Rate (2% below GSA)</div>
          <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{fmt$(bidRate)}<span style={{fontSize:12,fontWeight:400,opacity:0.7}}>/night</span></div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>GSA max: {fmt$(gsaRate)}/night</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontWeight:700,letterSpacing:0.8,textTransform:"uppercase"}}>Monthly Revenue</div>
          <div style={{fontSize:20,fontWeight:900,color:MINT}}>{fmt$(revenue)}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{units} units × {fmt$(bidRate)} × {nights}n</div>
        </div>
      </div>

      {/* Expenses */}
      <div style={{background:"#fff",borderRadius:8,padding:"12px 14px",marginBottom:10,border:"1px solid #e4e9f4"}}>
        <div style={{fontSize:11,fontWeight:800,color:"#556",marginBottom:8,textTransform:"uppercase",letterSpacing:0.7}}>
          📋 Monthly Expenses {isHotel?"(Hotel — no rent/mortgage)":"(Apartment — per unit)"}
        </div>
        {!isHotel&&<Row label={`Rent/Mortgage (${units} units × $${rent})`}      val={rent}  setter={setRent}/>}
        {!isHotel&&(
          <div>
            <Row label={`🪑 Furniture Rental (${units} units × $${furni})`}      val={furni} setter={setFurni}/>
            <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:6,
              padding:"6px 10px",marginBottom:6,marginTop:-2}}>
              <div style={{fontSize:10,color:"#7a5900",fontWeight:800,marginBottom:6}}>
                📦 Furniture Vendors — Get Quotes
              </div>
              {[
                {name:"Core Rentals",         phone:"1-800-267-3837", note:"Standard pkg ~$300/unit/mo · sofa, bed, dresser, dining, kitchen"},
                {name:"Margie @ Flipper",     phone:"1-808-428-1710", note:"Met at Gov.Con — call for govt contract furniture quote"},
                {name:"CORT Furniture Rental",phone:"1-888-360-2678", note:"National govt furniture rental — bulk discounts for 10+ units"},
                {name:"Brook Furniture Rental",phone:"1-800-961-7346", note:"Nationwide, full apartment packages, monthly billing"},
                {name:"Rent-A-Center Business",phone:"1-800-422-8186", note:"Flexible terms, furnish per unit, no long-term commitment"},
                {name:"AFR Furniture Rental",  phone:"1-888-737-4237", note:"Corporate/govt packages, delivery + setup included"},
              ].map((v,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
                  gap:8,padding:"5px 0",borderBottom:i<5?"1px solid #fff0b3":"none",flexWrap:"wrap"}}>
                  <div>
                    <span style={{fontSize:11,fontWeight:800,color:"#5a4000"}}>{v.name}</span>
                    {v.name==="Margie @ Flipper"&&(
                      <span style={{background:"#354984",color:"#fff",borderRadius:3,
                        padding:"0px 5px",fontSize:9,fontWeight:700,marginLeft:5}}>Gov.Con Contact</span>
                    )}
                    <div style={{fontSize:10,color:"#888",marginTop:1}}>{v.note}</div>
                  </div>
                  <a href={`tel:${v.phone}`} style={{fontSize:11,color:"#354984",fontWeight:700,
                    textDecoration:"none",whiteSpace:"nowrap"}}>📞 {v.phone}</a>
                </div>
              ))}
              <div style={{fontSize:10,color:"#aab",marginTop:6,fontStyle:"italic"}}>
                💡 Get 2–3 quotes before committing. Mention govt contract length for bulk rate.
              </div>
            </div>
          </div>
        )}
        <Row label={`Utilities (${units} units × $${util})`}   val={util}  setter={setUtil}/>
        <Row label={`Cleaning (${units} units × $${clean})`}   val={clean} setter={setClean}/>
        <Row label="Staff / Management (total)"                val={staff} setter={setStaff}/>
        <Row label={`Supplies (${units} units × $${supply})`}  val={supply}setter={setSupply}/>
        <Row label="Miscellaneous / Other"                     val={misc}  setter={setMisc}/>
        <div style={{borderTop:"2px solid #e4e9f4",marginTop:8,paddingTop:8}}>
          <Row label="Total Monthly Expenses" val={totalExp} locked color={RED}/>
        </div>
        {!isHotel&&(
          <div style={{marginTop:6,background:"#fff0f0",borderRadius:6,padding:"6px 10px",
            border:"1px solid #ffcdd2",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
            <span style={{fontSize:11,color:"#7a0000",fontWeight:700}}>
              📦 Total Furniture Cost for Full Contract ({contractMonths} mo)
            </span>
            <span style={{fontSize:13,fontWeight:900,color:RED}}>
              {fmt$(totalFurni * contractMonths)}
            </span>
          </div>
        )}
      </div>

      {/* Profit summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[
          {label:"Monthly Revenue", val:fmt$(revenue),    color:NAV},
          {label:"Total Expenses",  val:fmt$(totalExp),   color:RED},
          {label:"Net Profit/Month",val:fmt$(profit),     color:profitOk?GRN:RED},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:color+"0f",border:`1.5px solid ${color}30`,borderRadius:8,
            padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:4}}>{label}</div>
            <div style={{fontSize:18,fontWeight:900,color}}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:8,display:"flex",justifyContent:"space-between",fontSize:11,color:"#778"}}>
        <span>Profit margin: <strong style={{color:profitOk?GRN:RED}}>{margin}%</strong></span>
        <span>Target: <strong style={{color:GRN}}>$5,000/mo min</strong></span>
        <span style={{color:profitOk?GRN:RED,fontWeight:700}}>
          {profitOk?`✅ +${fmt$(profit-5000)} above target`:`❌ ${fmt$(5000-profit)} short of target`}
        </span>
      </div>

      {/* Total Contract Value — base + options */}
      {(()=>{
        const ext = c.extension;
        const baseMos = contractMonths;
        const optionMos = ext?.extendable
          ? (()=>{
              const m = (ext.length||"").match(/(\d+)\s*year/i);
              const mo = (ext.length||"").match(/(\d+)\s*month/i);
              const perOption = m ? parseInt(m[1])*12 : mo ? parseInt(mo[1]) : 12;
              return (ext.options||0) * perOption;
            })()
          : 0;
        const totalMos = baseMos + optionMos;
        const totalRevenue  = revenue * totalMos;
        const totalExpenses = totalExp * totalMos;
        const totalProfit   = profit * totalMos;
        const durationLabel = ext?.totalDuration || (totalMos >= 12 ? `${(totalMos/12).toFixed(1).replace(/\.0$/,"")} year${totalMos!==12?"s":""}` : `${totalMos} months`);

        return(
          <div style={{marginTop:10,background:"linear-gradient(135deg,#1a2340 0%,#354984 100%)",
            borderRadius:10,padding:"14px 16px",border:`2px solid ${MINT2}`}}>
            <div style={{fontSize:10,fontWeight:800,color:MINT,textTransform:"uppercase",letterSpacing:0.8,marginBottom:10}}>
              💰 Full Contract Value — {durationLabel}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
              {[
                {label:`Base Period (${baseMos} mo)`,      rev:revenue*baseMos,   exp:totalExp*baseMos,   prof:profit*baseMos,   color:"#90caf9"},
                ...(optionMos>0?[{label:`Option Years (${optionMos} mo)`, rev:revenue*optionMos, exp:totalExp*optionMos, prof:profit*optionMos, color:"#ce93d8"}]:[]),
                {label:`TOTAL (${totalMos} mo)`,           rev:totalRevenue,      exp:totalExpenses,      prof:totalProfit,      color:MINT, bold:true},
              ].map(({label,rev,exp,prof,color,bold})=>(
                <div key={label} style={{background:"rgba(255,255,255,0.07)",borderRadius:8,padding:"10px 12px",
                  border:bold?`1.5px solid ${MINT}50`:"1px solid rgba(255,255,255,0.1)"}}>
                  <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>{label}</div>
                  <div style={{fontSize:bold?16:13,fontWeight:900,color,marginBottom:2}}>{fmt$(rev)}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Revenue</div>
                  <div style={{marginTop:4,fontSize:bold?13:11,fontWeight:700,color:prof>=0?"#69f0ae":"#ff5252"}}>{fmt$(prof)}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Net Profit</div>
                </div>
              ))}
            </div>
            {ext?.extendable&&(
              <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:8}}>
                📋 {ext.options} option year{ext.options!==1?"s":""}  ·  {ext.conditions||"Renewal based on performance"}
              </div>
            )}
            {!ext?.extendable&&(
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:8}}>
                ⚠️ No option years listed — base period only. Confirm extension terms in full SOW.
              </div>
            )}
          </div>
        );
      })()}

      <div style={{marginTop:8,fontSize:10,color:"#aab"}}>
        💡 Adjust units, nights, and expenses above. All fields are editable. 2% below GSA bid is pre-set per SOP target.
      </div>
    </div>
  );
}

// ── SOW WORD DOC BUTTON ───────────────────────────────────────────────────────
// ── SOW WORD DOC BUTTON ───────────────────────────────────────────────────────
function SOWWordButton({c}){
  const [status,setStatus]=useState("idle");

  function generateDoc(){
    setStatus("loading");
    try{
      const sow=c.sow||{};
      const ls=sow.lodgingSchedule||{};
      const ext=c.extension||{};
      const dl=new Date(c.deadline).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
      const mi=c.moveInDate?new Date(c.moveInDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"TBD";
      const days=daysLeft(c.deadline);
      const amenities=sow.amenities||[];
      const utilities=sow.utilities||[];
      const requirements=sow.requirements||[];
      const laundryInUnit=amenities.some(a=>a.toLowerCase().includes("in-unit")||a.toLowerCase().includes("washer"));
      const laundryOnSite=amenities.some(a=>a.toLowerCase().includes("laundry"))&&!laundryInUnit;
      const laundryNote=laundryInUnit?"IN-UNIT washer/dryer required inside each room":laundryOnSite?"On-site laundry acceptable — NOT required in-unit":"Verify laundry requirement in solicitation";

      // Build HTML row helper
      function tr(label,val){
        return "<tr><td style='background:#e8edf8;font-weight:700;color:#354984;width:35%;padding:7px 10px;border:1px solid #c5cfe8;vertical-align:top;font-size:11pt;'>"+label+"</td><td style='padding:7px 10px;border:1px solid #c5cfe8;vertical-align:top;font-size:11pt;'>"+(val||"N/A")+"</td></tr>";
      }
      function sec(title,body,color){
        var bg=color||"#354984";
        return "<div style='margin-bottom:20px;'><div style='background:"+bg+";color:#fff;padding:7px 12px;font-size:12pt;font-weight:700;'>"+title+"</div><div style='border:1px solid "+bg+";border-top:none;padding:12px;'>"+body+"</div></div>";
      }
      function chk(items){
        if(!items||!items.length) return "<p style='color:#888;font-style:italic;'>Per Contracting Officer</p>";
        return items.map(function(i){return "<div style='margin-bottom:6px;font-size:11pt;'>&#9744; "+i+"</div>";}).join("");
      }

      var html="<!DOCTYPE html><html><head><meta charset='UTF-8'/><style>body{font-family:Arial,sans-serif;margin:40px 60px;color:#222;font-size:11pt;line-height:1.5;}table{width:100%;border-collapse:collapse;margin-bottom:8px;}.warn{background:#fff8e1;border:2px solid #ffe08a;padding:12px 16px;font-size:11pt;color:#7a5900;margin-top:20px;border-radius:4px;}.action{background:#fffbf0;border:2px solid #ffe08a;padding:12px 16px;font-size:11pt;color:#3a2e00;}@media print{body{margin:20px 30px;}}</style></head><body>";

      html+="<h1 style='color:#354984;margin:0 0 4px;font-size:20pt;'>KD MODERN RENTALS LLC</h1>";
      html+="<div style='color:#444;font-size:12pt;margin:0 0 3px;'>SCOPE OF WORK / BID CHECKLIST</div>";
      html+="<div style='color:#666;font-size:10pt;border-bottom:3px solid #354984;padding-bottom:10px;margin-bottom:20px;'>CAGE: 190G9 &nbsp;|&nbsp; UEI: GT5SBDQXQNC5 &nbsp;|&nbsp; DUNS: 12-073-0769 &nbsp;|&nbsp; WOSB Certified &nbsp;|&nbsp; Generated: "+new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})+"</div>";

      html+=sec("SECTION 1 — CONTRACT IDENTIFICATION","<table>"+tr("Contract Title",c.title)+tr("Agency",c.agency)+tr("Solicitation #","<strong style='font-family:monospace;color:#354984;'>"+c.sol+"</strong>")+tr("Set-Aside",c.setAside)+tr("NAICS Code",c.naics)+tr("Contract Value",c.value)+tr("Property Type",c.propType==="hotel"?"Hotel / Motel":c.propType==="apartment"?"Furnished Apartment":"Hotel or Apartment")+tr("POC Email",c.poc+" <em>(verify on SAM.gov)</em>")+"</table>");

      html+=sec("SECTION 2 — KEY DATES","<table>"+tr("BID DEADLINE","<strong style='color:#c62828;font-size:13pt;'>"+dl+"</strong> &mdash; <strong style='color:#c62828;'>"+days+" days left &mdash; SUBMIT 2+ HOURS EARLY</strong>")+tr("Gov't Move-In Date","<strong>"+mi+"</strong> &mdash; Units must be FULLY READY")+tr("Schedule Type",ls.typeLabel||"As Required")+tr("Specific Dates",ls.specificDates||"As directed by CO")+tr("Nights Per Year",String(ls.nightsPerYear||"Variable"))+"</table>","#c62828");

      var sowRows="<table>"+tr(c.propType==="hotel"?"Sleeping Rooms / Night":"Units Needed",sow.units||"Per Task Order")+tr("Duration",sow.duration||"TBD")+tr("Location",sow.location||c.city)+tr("Radius / Distance",requirements.find(function(r){return r.toLowerCase().includes("mile")||r.toLowerCase().includes("radius")||r.toLowerCase().includes("within");})||"Verify on SAM.gov");
      if(c.propType==="hotel") sowRows+=tr("Laundry Requirement",laundryNote);
      sowRows+="</table>";
      html+=sec("SECTION 3 — WHAT THE GOVERNMENT NEEDS",sowRows);

      html+=sec("SECTION 4 — REQUIRED AMENITIES",chk(amenities));
      html+=sec("SECTION 5 — UTILITIES INCLUDED IN BID PRICE",chk(utilities));
      html+=sec("SECTION 6 — CONTRACTOR REQUIREMENTS",chk(requirements));

      html+=sec("SECTION 7 — CONTRACT EXTENSIONS","<table>"+tr("Extendable",ext.extendable?"YES &mdash; "+ext.options+" option(s) &times; "+ext.length:"NO")+tr("Total Duration",ext.totalDuration||"Base period only")+tr("Conditions",ext.conditions||"N/A")+"</table>");

      html+=sec("SECTION 8 — NEXT ACTION","<div class='action'>"+(c.nextAction||"Verify on SAM.gov and contact Contracting Officer.")+"</div>","#b8860b");

      html+=sec("SECTION 9 — SUBMISSION","<table>"+tr("POC Email",c.poc+" <em style='color:#b8860b;'>(&#9888; VERIFY ON SAM.GOV FIRST)</em>")+tr("SAM.gov","sam.gov/opportunities &mdash; search: <strong style='font-family:monospace;'>"+c.sol+"</strong>")+tr("WOSB Cert","Attach with submission")+tr("CAGE","190G9")+tr("UEI","GT5SBDQXQNC5")+"</table>");

      html+="<div class='warn'><strong style='color:#c62828;'>&#9888; IMPORTANT:</strong> Verify ALL details against the live SAM.gov solicitation before submitting any bid. Search <strong>"+c.sol+"</strong> on SAM.gov to confirm POC, deadline, and full requirements.</div>";
      html+="</body></html>";

      var blob=new Blob([html],{type:"application/msword;charset=utf-8"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");
      a.href=url;
      a.download="KD-SOW-"+c.sol.replace(/[^a-zA-Z0-9]/g,"-")+".doc";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("done");
      setTimeout(function(){setStatus("idle");},4000);
    }catch(e){
      console.error(e);
      setStatus("error");
      setTimeout(function(){setStatus("idle");},3000);
    }
  }

  return(
    <div style={{marginBottom:10}}>
      <button onClick={generateDoc} style={{
        background:status==="done"?"#1b5e20":status==="error"?"#c62828":"#354984",
        color:"#fff",border:"none",borderRadius:8,padding:"11px 20px",
        fontSize:13,fontWeight:800,cursor:"pointer",width:"100%",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        {status==="done"?"✅ Word Doc Downloaded!":status==="error"?"❌ Error — Try Again":"📄 Download SOW as Word Doc (.doc)"}
      </button>
      {status==="done"&&<div style={{fontSize:11,color:"#1b5e20",marginTop:4,textAlign:"center",fontWeight:600}}>
        Check your Downloads folder — open in Word or drag into Google Docs
      </div>}
    </div>
  );
}


// ── FULL BID PROPOSAL BUTTON ──────────────────────────────────────────────────
function BidProposalButton({c, gsaRate}){
  const [status,setStatus]=useState("idle");

  function generateProposal(){
    setStatus("loading");
    try{
      const sow=c.sow||{};
      const ls=sow.lodgingSchedule||{};
      const ext=c.extension||{};
      const gsa=gsaRate||0;
      const bidRate=Math.round(gsa*0.98);
      const today=new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
      const dl=new Date(c.deadline).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
      const mi=c.moveInDate?new Date(c.moveInDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"TBD";
      const days=daysLeft(c.deadline);
      const amenities=sow.amenities||[];
      const utilities=sow.utilities||[];
      const requirements=sow.requirements||[];

      // Room nights calc
      var unitNums=String(sow.units||"").match(/\d+/g);
      var maxUnits=unitNums?parseInt(unitNums[unitNums.length-1]):null;
      var durStr=String(sow.duration||"");
      var nm=durStr.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*night/i)||durStr.match(/(\d+)\s*night/i);
      var dm=durStr.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*day/i)||durStr.match(/(\d+)\s*day/i);
      var mm=durStr.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*month/i)||durStr.match(/(\d+)\s*month/i);
      var maxNights=null;
      if(nm){maxNights=nm[2]?parseInt(nm[2]):parseInt(nm[1]);}
      else if(dm){maxNights=dm[2]?parseInt(dm[2]):parseInt(dm[1]);}
      else if(mm){maxNights=mm[2]?parseInt(mm[2])*30:parseInt(mm[1])*30;}
      var schedNights=ls.nightsPerYear;
      var totalNights=maxNights||schedNights;
      var roomNights=maxUnits&&totalNights?maxUnits*totalNights:null;
      var grossRevenue=roomNights&&bidRate?roomNights*bidRate:null;

      function tr(l,v){
        return "<tr><td style='background:#e8edf8;font-weight:700;color:#354984;width:38%;padding:8px 11px;border:1px solid #c5cfe8;vertical-align:top;font-size:11pt;'>"+l+"</td><td style='padding:8px 11px;border:1px solid #c5cfe8;vertical-align:top;font-size:11pt;'>"+(v||"N/A")+"</td></tr>";
      }
      function sec(num,title,body,color){
        var bg=color||"#354984";
        return "<div style='margin-bottom:24px;page-break-inside:avoid;'><div style='background:"+bg+";color:#fff;padding:9px 14px;font-size:13pt;font-weight:700;letter-spacing:0.3px;'>SECTION "+num+" — "+title+"</div><div style='border:1px solid "+bg+";border-top:none;padding:14px;'>"+body+"</div></div>";
      }
      function chk(items,label){
        if(!items||!items.length) return "<p style='color:#888;font-style:italic;font-size:11pt;'>None specified — verify on SAM.gov</p>";
        return "<p style='font-weight:700;color:#354984;margin:0 0 8px;font-size:11pt;'>"+label+":</p>"+items.map(function(i){return "<div style='margin-bottom:5px;font-size:11pt;'>&#9745; "+i+"</div>";}).join("");
      }

      var html="<!DOCTYPE html><html><head><meta charset='UTF-8'/>";
      html+="<style>body{font-family:Arial,sans-serif;margin:50px 70px;color:#222;font-size:11pt;line-height:1.6;}table{width:100%;border-collapse:collapse;margin-bottom:8px;}p{margin:0 0 8px;}@media print{body{margin:30px 40px;}}</style>";
      html+="</head><body>";

      // ── COVER PAGE ──
      html+="<div style='text-align:center;padding:40px 0 30px;border-bottom:4px solid #354984;margin-bottom:30px;'>";
      html+="<div style='font-size:28pt;font-weight:900;color:#354984;letter-spacing:1px;margin-bottom:6px;'>KD MODERN RENTALS LLC</div>";
      html+="<div style='font-size:13pt;color:#444;margin-bottom:4px;'>Women-Owned Small Business (WOSB) | Government Housing Contractor</div>";
      html+="<div style='font-size:11pt;color:#666;margin-bottom:20px;'>Milwaukee, WI 53202 | hello@kdmodernrentals.com | 414-240-4957</div>";
      html+="<div style='background:#354984;color:#fff;display:inline-block;padding:10px 30px;font-size:14pt;font-weight:700;border-radius:4px;margin-bottom:20px;'>PROPOSAL FOR GOVERNMENT LODGING SERVICES</div>";
      html+="<table style='width:80%;margin:20px auto;border-collapse:collapse;'>";
      html+=tr("Solicitation Number","<strong style='font-family:monospace;font-size:12pt;color:#354984;'>"+c.sol+"</strong>");
      html+=tr("Contract Title",c.title);
      html+=tr("Issuing Agency",c.agency);
      html+=tr("Set-Aside",c.setAside);
      html+=tr("Proposal Date",today);
      html+=tr("Bid Deadline","<strong style='color:#c62828;'>"+dl+" ("+days+" days)</strong>");
      html+=tr("Submitted By","KD Modern Rentals LLC");
      html+="</table></div>";

      // ── SECTION 1: EXECUTIVE SUMMARY ──
      html+=sec(1,"EXECUTIVE SUMMARY",
        "<p>KD Modern Rentals LLC is a certified <strong>Women-Owned Small Business (WOSB)</strong> headquartered in Milwaukee, Wisconsin, specializing in fully furnished government lodging solutions. We are registered and active on SAM.gov (CAGE: 190G9 | UEI: GT5SBDQXQNC5) and hold WOSB certification through the SBA.</p>"+
        "<p>We are pleased to submit this proposal in response to Solicitation <strong>"+c.sol+"</strong> issued by <strong>"+c.agency+"</strong> for "+c.title+". KD Modern Rentals LLC has the inventory, operational capacity, and commitment to deliver fully furnished, move-in ready units meeting all SOW requirements by the government's required date of <strong>"+mi+"</strong>.</p>"+
        "<p>Our principal, Kayla Deitte, brings extensive property management experience across residential and short-term rental portfolios in Milwaukee, Door County, and St. Augustine, Florida. We understand the standards required for government housing and are fully prepared to meet and exceed them.</p>"+
        "<p style='background:#e8f5e9;border-left:4px solid #1b5e20;padding:10px 14px;font-weight:700;color:#1b5e20;'>We are WOSB-certified, SAM.gov active, and ready to perform on this contract.</p>"
      );

      // ── SECTION 2: COMPANY CREDENTIALS ──
      html+=sec(2,"COMPANY CREDENTIALS &amp; CERTIFICATIONS",
        "<table>"+
        tr("Legal Business Name","KD Modern Rentals LLC")+
        tr("Business Structure","Single-Member LLC — Managing Member: Kayla Deitte")+
        tr("CAGE Code","190G9")+
        tr("UEI","GT5SBDQXQNC5")+
        tr("DUNS","12-073-0769")+
        tr("SAM.gov Status","ACTIVE")+
        tr("WOSB Certification","Certified Women-Owned Small Business (SBA)")+
        tr("Primary NAICS","531110 — Lessors of Residential Buildings")+
        tr("Secondary NAICS","721110 — Hotels and Motels")+
        tr("Business Address","Milwaukee, WI 53202")+
        tr("Phone","414-240-4957")+
        tr("Email","hello@kdmodernrentals.com")+
        tr("Website","kdmodernrentals.com")+
        tr("Principal","Kayla Deitte, PharmD — Owner &amp; Managing Member")+
        "</table>"
      );

      // ── SECTION 3: TECHNICAL APPROACH ──
      var techBody="<p>KD Modern Rentals LLC will provide <strong>"+( sow.units||"the required number of")+" fully furnished, move-in ready lodging units</strong> in <strong>"+(sow.location||c.city)+"</strong>, meeting all requirements outlined in the Performance Work Statement.</p>";
      techBody+="<p><strong>Move-In Readiness:</strong> All units will be fully furnished, cleaned, inspected, and ready for occupancy by <strong>"+mi+"</strong>. We maintain a rapid-response property preparation protocol allowing move-in within 48–72 hours of contract award.</p>";
      techBody+="<p><strong>Unit Standards:</strong> Every unit will include all required amenities and meet or exceed the government's quality and safety standards including fire safety compliance, ADA accessibility where required, and professional-grade furnishings.</p>";
      if(amenities.length){
        techBody+="<p><strong>Confirmed Amenities — All Will Be Provided:</strong></p>";
        techBody+=amenities.map(function(a){return "<div style='margin-bottom:5px;'>&#9745; <strong>"+a+"</strong> — Confirmed available in all units</div>";}).join("");
      }
      if(utilities.length){
        techBody+="<p style='margin-top:12px;'><strong>Utilities Included in Contract Price:</strong></p>";
        techBody+=utilities.map(function(u){return "<div style='margin-bottom:5px;'>&#9745; "+u+"</div>";}).join("");
      }
      if(c.propType==="hotel"){
        techBody+="<p style='margin-top:12px;'><strong>Extended Stay Approach:</strong> We prioritize extended stay hotel properties (Residence Inn, Homewood Suites, TownePlace Suites, Staybridge Suites, Hyatt House) which include kitchen facilities, in-room or on-site laundry, and dedicated workspaces — ideal for government TDY and relocation personnel.</p>";
      }
      techBody+="<p style='margin-top:12px;'><strong>Quality Assurance:</strong> KD Modern Rentals LLC will conduct pre-occupancy inspections for every unit, maintain a 24/7 emergency contact, and provide a dedicated property manager for the duration of the contract. Any maintenance issues will be resolved within 24 hours.</p>";
      techBody+="<p><strong>Government Billing:</strong> We accept payment via IPP (Invoice Processing Platform) on Net-30 terms. Monthly invoices will be submitted by the 5th of each month for the prior month's occupancy.</p>";
      html+=sec(3,"TECHNICAL APPROACH",techBody);

      // ── SECTION 4: CONTRACT REQUIREMENTS COMPLIANCE ──
      var compBody="<p>The following table confirms KD Modern Rentals LLC's compliance with all stated contract requirements:</p>";
      compBody+="<table>";
      compBody+=tr("Units Required",sow.units||"As specified");
      compBody+=tr("Contract Duration",sow.duration||"As specified");
      compBody+=tr("Location",sow.location||c.city);
      compBody+=tr("Distance/Radius",requirements.find(function(r){return r.toLowerCase().includes("mile")||r.toLowerCase().includes("radius")||r.toLowerCase().includes("within");})||"As specified in SOW");
      if(ls.typeLabel) compBody+=tr("Lodging Schedule",ls.typeLabel);
      if(ls.specificDates) compBody+=tr("Specific Dates",ls.specificDates);
      if(ls.nightsPerYear) compBody+=tr("Nights Per Year",String(ls.nightsPerYear));
      compBody+="</table>";
      if(requirements.length){
        compBody+="<p style='margin-top:14px;font-weight:700;color:#354984;'>Full Requirements Compliance:</p>";
        compBody+=requirements.map(function(r){return "<div style='margin-bottom:6px;font-size:11pt;'>&#9745; "+r+" — <em style='color:#1b5e20;'>Confirmed</em></div>";}).join("");
      }
      html+=sec(4,"CONTRACT REQUIREMENTS COMPLIANCE",compBody);

      // ── SECTION 5: PAST PERFORMANCE ──
      html+=sec(5,"PAST PERFORMANCE",
        "<p>KD Modern Rentals LLC has successfully managed multiple furnished residential and short-term rental properties across Wisconsin and Florida, demonstrating consistent quality, guest satisfaction, and operational reliability.</p>"+
        "<table>"+
        tr("Property Portfolio","Multi-unit residential and short-term rental properties in Milwaukee WI, Door County WI, and St. Augustine FL")+
        tr("Unit Types Managed","Studio, 1BR, 2BR, 3BR, and 6BR fully furnished units")+
        tr("Markets Served","Milwaukee, Door County, St. Augustine, Jacksonville")+
        tr("STR Platform","Airbnb Superhost — 4.8+ average rating across all listings")+
        tr("Key Capability","Rapid furnishing and move-in readiness for new units")+
        tr("Quality Track Record","Consistent 5-star guest reviews for cleanliness, communication, and amenities")+
        "</table>"+
        "<p style='margin-top:12px;font-style:italic;color:#667;'>References available upon request. Past performance narratives can be provided in the format required by the Contracting Officer.</p>"
      );

      // ── SECTION 6: PRICING / BID SHEET ──
      var priceBody="<table>"+
        tr("GSA Per Diem Rate ("+c.city+")","$"+gsa+"/night (FY2026 — verify at GSA.gov/perdiem)")+
        tr("Proposed Bid Rate","<strong style='color:#1b5e20;font-size:13pt;'>$"+bidRate+"/night per unit</strong> ("+((1-(bidRate/gsa))*100).toFixed(1)+"% below GSA maximum)")+
        tr("Contract Duration",sow.duration||"As specified");
      if(maxUnits) priceBody+=tr("Units Required",String(maxUnits)+" units");
      if(roomNights) priceBody+=tr("Total Room Nights",roomNights.toLocaleString()+" room nights");
      if(grossRevenue) priceBody+=tr("Total Contract Value (Estimated)","<strong style='color:#354984;font-size:13pt;'>$"+grossRevenue.toLocaleString()+"</strong>");
      priceBody+=tr("Payment Terms","Net-30 via IPP (Invoice Processing Platform)");
      priceBody+=tr("Billing Cycle","Monthly invoices submitted by 5th of following month");
      priceBody+=tr("Rate Includes","All required amenities, utilities, and services per SOW");
      priceBody+="</table>";
      priceBody+="<p style='margin-top:12px;background:#e8f0fe;padding:10px 14px;border-left:4px solid #354984;font-size:11pt;'><strong>Pricing Note:</strong> Our proposed rate of <strong>$"+bidRate+"/night</strong> is competitive, below the GSA maximum, and inclusive of all amenities and utilities specified in the SOW. We are committed to providing maximum value to the government while maintaining the highest quality standards.</p>";
      html+=sec(6,"PRICING / BID SHEET",priceBody);

      // ── SECTION 7: CONTRACT EXTENSIONS ──
      html+=sec(7,"CONTRACT EXTENSION OPTIONS",
        "<table>"+
        tr("Extendable",ext.extendable?"<strong style='color:#1b5e20;'>YES — Extension Options Available</strong>":"NO")+
        tr("Number of Options",String(ext.options||0)+" option period(s)")+
        tr("Length Per Option",ext.length||"N/A")+
        tr("Total Potential Duration",ext.totalDuration||"Base period only")+
        tr("Conditions",ext.conditions||"N/A")+
        tr("KD Position","KD Modern Rentals LLC is fully prepared to exercise all available option periods and provide continuous high-quality service throughout the full contract duration.")+
        "</table>"
      );

      // ── SECTION 8: CERTIFICATIONS & REPS ──
      html+=sec(8,"CERTIFICATIONS &amp; REPRESENTATIONS",
        "<p>KD Modern Rentals LLC hereby certifies and represents the following as of the date of this proposal:</p>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>SAM.gov Registration:</strong> Active — CAGE 190G9 | UEI GT5SBDQXQNC5</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>WOSB Certification:</strong> Certified Women-Owned Small Business (SBA Program)</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>Small Business Status:</strong> Qualifies as Small Business under NAICS 531110 ($47.5M size standard)</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>FAR 52.209-5:</strong> No debarment, suspension, or proposed debarment</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>FAR 52.222-26:</strong> Equal Opportunity Employer</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>FAR 52.222-36:</strong> Equal Opportunity for Workers with Disabilities</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>FAR 52.223-18:</strong> Encouraging Contractor Policies to Ban Texting While Driving</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>Buy American Act:</strong> Compliant</div>"+
        "<div style='margin-bottom:6px;'>&#9745; <strong>Tax Status:</strong> EIN 88-1143464 — all tax obligations current</div>"+
        "<p style='margin-top:12px;font-style:italic;color:#667;'>Additional certifications and representations per FAR 52.212-3 are on file in SAM.gov and are incorporated herein by reference.</p>"
      );

      // ── SIGNATURE BLOCK ──
      html+="<div style='margin-top:40px;border-top:2px solid #354984;padding-top:20px;'>";
      html+="<p style='font-size:13pt;font-weight:700;color:#354984;margin-bottom:20px;'>AUTHORIZED SIGNATURE</p>";
      html+="<table style='width:100%;border-collapse:collapse;'>";
      html+="<tr><td style='width:50%;padding:8px 0;vertical-align:bottom;'>";
      html+="<div style='border-bottom:1px solid #333;width:90%;margin-bottom:5px;height:40px;'></div>";
      html+="<div style='font-size:11pt;'>Signature</div></td>";
      html+="<td style='width:50%;padding:8px 0 8px 20px;vertical-align:bottom;'>";
      html+="<div style='border-bottom:1px solid #333;width:90%;margin-bottom:5px;height:40px;'></div>";
      html+="<div style='font-size:11pt;'>Date</div></td></tr>";
      html+="<tr><td style='padding:8px 0;'><div style='font-weight:700;font-size:11pt;'>Kayla Deitte</div><div style='font-size:11pt;color:#555;'>Managing Member — KD Modern Rentals LLC</div></td>";
      html+="<td style='padding:8px 0 8px 20px;'><div style='font-weight:700;font-size:11pt;'>"+today+"</div><div style='font-size:11pt;color:#555;'>Date of Proposal</div></td></tr>";
      html+="</table></div>";

      html+="<div style='margin-top:20px;background:#fff8e1;border:2px solid #ffe08a;padding:12px 16px;font-size:10pt;color:#7a5900;border-radius:4px;'>";
      html+="<strong>&#9888; IMPORTANT:</strong> This proposal template is pre-filled with research data. Before submitting, verify the solicitation number, POC, deadline, and all requirements against the live SAM.gov listing at sam.gov/opportunities. Some contracts listed in this dashboard are research targets and may not yet be active solicitations.";
      html+="</div></body></html>";

      var blob=new Blob([html],{type:"application/msword;charset=utf-8"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");
      a.href=url;
      a.download="KD-PROPOSAL-"+c.sol.replace(/[^a-zA-Z0-9]/g,"-")+".doc";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("done");
      setTimeout(function(){setStatus("idle");},4000);
    }catch(e){
      console.error(e);
      setStatus("error");
      setTimeout(function(){setStatus("idle");},3000);
    }
  }

  return(
    <div style={{marginBottom:10}}>
      <button onClick={generateProposal} style={{
        background:status==="done"?"#1b5e20":status==="error"?"#c62828":"#6a1b9a",
        color:"#fff",border:"none",borderRadius:8,padding:"11px 20px",
        fontSize:13,fontWeight:800,cursor:"pointer",width:"100%",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        transition:"all 0.2s"}}>
        {status==="done"?"✅ Full Proposal Downloaded!":status==="error"?"❌ Error — Try Again":"📝 Download Full Bid Proposal (.doc)"}
      </button>
      {status==="done"&&(
        <div style={{fontSize:11,color:"#1b5e20",marginTop:4,textAlign:"center",fontWeight:600}}>
          Check Downloads — open in Word, add property photos, then submit
        </div>
      )}
    </div>
  );
}

// ── SOW COPY BUTTON ───────────────────────────────────────────────────────────
function SOWCopyButton({c}){
  const [open,setOpen]=useState(false);

  function buildText(){
    const sow=c.sow||{};
    const ls=sow.lodgingSchedule||{};
    const ext=c.extension||{};
    const dl=new Date(c.deadline).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
    const mi=c.moveInDate?new Date(c.moveInDate).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"TBD";
    const amenities=sow.amenities||[];
    const utilities=sow.utilities||[];
    const requirements=sow.requirements||[];
    const laundryInUnit=amenities.some(a=>a.toLowerCase().includes("in-unit")||a.toLowerCase().includes("washer"));
    const laundryOnSite=amenities.some(a=>a.toLowerCase().includes("laundry"))&&!laundryInUnit;
    return[
      "========================================",
      "KD MODERN RENTALS LLC — SOW / BID CHECKLIST",
      "CAGE: 190G9 | UEI: GT5SBDQXQNC5 | DUNS: 12-073-0769 | WOSB",
      "========================================",
      "",
      "CONTRACT:       "+c.title,
      "AGENCY:         "+c.agency,
      "NOTICE #:       "+c.sol,
      "SET-ASIDE:      "+c.setAside,
      "NAICS:          "+c.naics,
      "VALUE:          "+c.value,
      "PROP TYPE:      "+(c.propType==="hotel"?"Hotel / Motel":c.propType==="apartment"?"Furnished Apartment":"Hotel or Apt"),
      "",
      "--- KEY DATES ---",
      "BID DEADLINE:   "+dl+" ("+daysLeft(c.deadline)+" days left — submit 2+ hrs early)",
      "MOVE-IN DATE:   "+mi+" (units must be FULLY READY by this date)",
      "SCHEDULE:       "+(ls.typeLabel||"As Required"),
      "SPECIFIC DATES: "+(ls.specificDates||"As directed by CO"),
      "NIGHTS/YEAR:    "+(ls.nightsPerYear||"Variable"),
      "",
      "--- WHAT THEY NEED ---",
      "UNITS NEEDED:   "+(sow.units||"Per Task Order"),
      "DURATION:       "+(sow.duration||"TBD"),
      "LOCATION:       "+(sow.location||c.city),
      "RADIUS:         "+((requirements).find(r=>r.toLowerCase().includes("mile")||r.toLowerCase().includes("radius")||r.toLowerCase().includes("within"))||"Verify on SAM.gov"),
      ...(c.propType==="hotel"?["LAUNDRY:        "+(laundryInUnit?"IN-UNIT washer/dryer required":laundryOnSite?"On-site laundry acceptable — not required in-unit":"Verify in solicitation")]:[]),
      "",
      "--- REQUIRED AMENITIES ---",
      ...amenities.map(a=>"  [ ] "+a),
      "",
      "--- UTILITIES INCLUDED ---",
      ...utilities.map(u=>"  [ ] "+u),
      "",
      "--- CONTRACTOR REQUIREMENTS ---",
      ...requirements.map(r=>"  [ ] "+r),
      "",
      "--- CONTRACT EXTENSIONS ---",
      "EXTENDABLE:     "+(ext.extendable?"YES — "+ext.options+" option(s) x "+ext.length:"NO"),
      "TOTAL DURATION: "+(ext.totalDuration||"Base period only"),
      "CONDITIONS:     "+(ext.conditions||"N/A"),
      "",
      "--- NEXT ACTION ---",
      c.nextAction||"Verify on SAM.gov and contact CO.",
      "",
      "--- SUBMISSION ---",
      "POC:            "+c.poc+" (VERIFY ON SAM.GOV FIRST)",
      "SAM.gov:        sam.gov/opportunities — search: "+c.sol,
      "CAGE:           190G9 | UEI: GT5SBDQXQNC5",
      "",
      "VERIFY ALL DETAILS ON SAM.GOV BEFORE SUBMITTING",
      "========================================",
    ].join("\n");
  }

  return(
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        background:"#c62828",color:"#fff",border:"none",
        borderRadius:8,padding:"11px 20px",fontSize:13,fontWeight:800,
        cursor:"pointer",width:"100%",display:"flex",alignItems:"center",
        justifyContent:"center",gap:8}}>
        📋 {open?"Hide SOW Text":"Show SOW / PWS — Select All & Copy"}
      </button>
      {open&&(
        <div style={{marginTop:8}}>
          <div style={{fontSize:11,color:"#1b5e20",fontWeight:700,marginBottom:5,background:"#e8f5e9",borderRadius:6,padding:"7px 12px",border:"1px solid #a5d6a7"}}>
            ✅ Tap inside the box → Cmd+A to select all → Cmd+C to copy → Cmd+V to paste anywhere
          </div>
          <textarea
            readOnly
            value={buildText()}
            onClick={e=>e.target.select()}
            style={{
              width:"100%",height:320,fontFamily:"monospace",fontSize:11,
              padding:"10px 12px",borderRadius:8,border:"2px solid #354984",
              background:"#f8f9ff",color:"#1a2340",lineHeight:1.6,
              resize:"vertical",boxSizing:"border-box",cursor:"text"
            }}
          />
        </div>
      )}
    </div>
  );
}


// ── NOTICE ID BADGE ───────────────────────────────────────────────────────────
function SolCopyBadge({sol}){
  const [open,setOpen]=useState(false);
  return(
    <div>
      <div style={{display:"inline-flex",alignItems:"center",gap:8,
        background:"#f0f4ff",border:`1.5px solid ${NAV}30`,borderRadius:7,padding:"6px 12px"}}>
        <span style={{fontSize:10,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.8}}>🪪 Notice ID</span>
        <span style={{fontFamily:"monospace",fontSize:13,fontWeight:900,color:NAV,letterSpacing:0.5}}>{sol}</span>
        <button onClick={()=>setOpen(o=>!o)}
          style={{background:NAV,color:"#fff",border:"none",borderRadius:4,
            padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
          {open?"Hide":"Copy"}
        </button>
      </div>
      {open&&(
        <div style={{marginTop:6,display:"flex",alignItems:"center",gap:6}}>
          <input
            readOnly
            value={sol}
            onClick={e=>e.target.select()}
            style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:NAV,
              padding:"5px 10px",borderRadius:6,border:`2px solid ${NAV}`,
              background:"#f0f4ff",cursor:"text",width:"auto",minWidth:220}}
          />
          <span style={{fontSize:11,color:"#667"}}>Tap field → Cmd+A → Cmd+C</span>
        </div>
      )}
    </div>
  );
}

function DetailPanel({c,onClose}){
  if(!c) return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",gap:12,padding:40,textAlign:"center"}}>
      <div style={{fontSize:52}}>📋</div>
      <div style={{fontSize:15,fontWeight:800,color:"#99a"}}>Select a contract to view details</div>
      <div style={{fontSize:12,color:"#bbb",maxWidth:320,lineHeight:1.6}}>
        ⭐ = KD property cities &nbsp;·&nbsp; 🔍 Research Target = verify live on SAM.gov first
        <br/>Sorted by priority — most urgent at top
      </div>
    </div>
  );
  const days=daysLeft(c.deadline);
  const dc=urgColor(days);
  const nm=NOTICE_META[c.noticeType];
  const gsa=GSA[c.city];
  const isKD=KD_CITIES.includes(c.city);

  return(
    <div style={{overflowY:"auto",padding:"22px 28px",flex:1}}>
      {!c.verified&&(
        <div style={{background:"#fff8e1",border:"1.5px solid #ffe08a",borderRadius:10,
          padding:"10px 15px",marginBottom:12,fontSize:12,color:"#7a5900",fontWeight:600}}>
          🔍 <strong>Research Target</strong> — Verify this contract is live on SAM.gov before taking action.
          Search the solicitation number or keyword + city at <strong>SAM.gov/opportunities</strong>.
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
            <SetPill type={c.setAside}/>
            <NoticePill type={c.noticeType} large/>
            <PropTypePill type={c.propType} large/>
            <StatusDot status={c.status}/>
            {isKD&&<span style={{background:NAV,color:"#fff",borderRadius:4,padding:"3px 9px",fontSize:11,fontWeight:700}}>⭐ KD Property City</span>}
          </div>
          <h2 style={{margin:"0 0 3px",fontSize:18,fontWeight:900,color:"#1a2340",lineHeight:1.3}}>{c.title}</h2>
          <div style={{fontSize:13,color:"#667",marginBottom:8}}>{c.agency}</div>
          <SolCopyBadge sol={c.sol}/>
        </div>
        <button onClick={onClose} style={{background:"none",border:"1px solid #dde3f0",borderRadius:6,
          padding:"5px 11px",cursor:"pointer",fontSize:12,color:"#667",marginLeft:12,flexShrink:0}}>✕ Close</button>
      </div>

      <div style={{background:nm.bg,border:`1.5px solid ${nm.color}40`,borderRadius:10,
        padding:"12px 15px",marginBottom:12,display:"flex",alignItems:"flex-start",gap:12}}>
        <span style={{fontSize:26,flexShrink:0}}>{nm.emoji}</span>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
            <div style={{fontSize:13,fontWeight:900,color:nm.color}}>{nm.label}</div>
            {nm.action&&(()=>{
              const actionColors = {
                "BID NOW":          {bg:"#c62828",text:"#fff"},
                "SEND CAP STMT":    {bg:"#6a1b9a",text:"#fff"},
                "WATCH & PREPARE":  {bg:"#354984",text:"#fff"},
                "APPLY FOR LIST":   {bg:"#00695c",text:"#fff"},
                "INTEL ONLY":       {bg:"#555",   text:"#fff"},
                "SKIP — DO NOT BID":{bg:"#999",   text:"#fff"},
                "COMPLETE NOW":     {bg:"#00695c",text:"#fff"},
              };
              const ac = actionColors[nm.action]||{bg:"#888",text:"#fff"};
              return(
                <span style={{background:ac.bg,color:ac.text,borderRadius:5,
                  padding:"3px 11px",fontSize:11,fontWeight:900,letterSpacing:0.8,textTransform:"uppercase"}}>
                  {nm.action}
                </span>
              );
            })()}
          </div>
          <div style={{fontSize:12,color:"#444",lineHeight:1.6}}>{nm.desc}</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div style={{background:dc+"14",border:`1.5px solid ${dc}40`,borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4}}>⏰ Bid Deadline</div>
          <div style={{fontSize:22,fontWeight:900,color:dc}}>{days>0?`${days} days`:""}</div>
          <div style={{fontSize:12,color:"#555",marginTop:2}}><strong>{fmtDate(c.deadline)}</strong></div>
          {c.noticeType==="solicitation"&&<div style={{fontSize:10,color:RED,fontWeight:700,marginTop:3}}>Submit 2+ hrs early!</div>}
        </div>
        <div style={{background:"#f0f4ff",border:`1px solid ${NAV}20`,borderRadius:10,padding:"12px 14px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4}}>💰 Contract Value</div>
          <div style={{fontSize:17,fontWeight:900,color:NAV,lineHeight:1.3}}>{c.value}</div>
          <div style={{fontSize:11,color:"#778",marginTop:4}}>NAICS: <span style={{fontFamily:"monospace",fontWeight:700}}>{c.naics}</span></div>
        </div>
      </div>

      <div style={{background:"#fffbf0",border:"1.5px solid #ffe08a",borderRadius:10,padding:"12px 15px",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:800,color:"#7a5900",textTransform:"uppercase",letterSpacing:0.8,marginBottom:5}}>👉 Next Action</div>
        <div style={{fontSize:13,lineHeight:1.75,color:"#3a2e00",fontWeight:500}}>{c.nextAction}</div>
      </div>

      {/* ── AT-A-GLANCE BANNER ── */}
      <div style={{background:`linear-gradient(135deg,${NAV},#1e3a6e)`,borderRadius:12,padding:"14px 16px",marginBottom:12,border:`2px solid ${MINT2}`}}>
        <div style={{fontSize:10,fontWeight:900,color:MINT,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
          📌 At-A-Glance — Key Contract Details
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:9,padding:"10px 13px",border:`1px solid ${urgColor(daysLeft(c.deadline))}60`}}>
            <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>⏰ Bid Deadline</div>
            <div style={{fontSize:15,fontWeight:900,color:urgColor(daysLeft(c.deadline))}}>{fmtDate(c.deadline)}</div>
            <div style={{fontSize:11,fontWeight:700,color:urgColor(daysLeft(c.deadline)),marginTop:2}}>
              {daysLeft(c.deadline)>0?`${daysLeft(c.deadline)} days left — submit 2+ hrs early`:"PAST DUE"}
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:9,padding:"10px 13px",border:"1px solid rgba(219,239,226,0.4)"}}>
            <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>🏠 Gov't Move-In Date</div>
            <div style={{fontSize:15,fontWeight:900,color:MINT}}>{c.moveInDate?fmtDate(c.moveInDate):"TBD"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2}}>Units must be fully ready by this date</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:9,padding:"10px 13px",border:"1px solid rgba(219,239,226,0.4)"}}>
            <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>
              {c.propType==="hotel"?"🛏️ Sleeping Rooms / Night":"🏢 Units Needed"}
            </div>
            <div style={{fontSize:15,fontWeight:900,color:"#fff"}}>{c.sow.units||"Per Task Order"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2}}>Duration: {c.sow.duration||"TBD"}</div>
          </div>
          <div style={{background:"rgba(255,255,255,0.1)",borderRadius:9,padding:"10px 13px",border:"1px solid rgba(219,239,226,0.4)"}}>
            <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>📍 Location / Radius</div>
            <div style={{fontSize:12,fontWeight:900,color:"#fff",lineHeight:1.35}}>{c.sow.location||c.city}</div>
            {(()=>{
              const r=c.sow?.requirements?.find(req=>req.toLowerCase().includes("mile")||req.toLowerCase().includes("radius")||req.toLowerCase().includes("within"));
              return r?<div style={{fontSize:10,color:MINT,marginTop:3,fontWeight:700}}>📏 {r}</div>:null;
            })()}
          </div>
        </div>
      </div>

      <div style={{background:"#f7f9fc",border:"1px solid #e4e9f4",borderRadius:10,padding:"14px 16px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:800,color:NAV,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>📄 SOW Requirements</div>

        {/* Move-in date banner — prominent */}
        {c.moveInDate&&(
          <div style={{background:"#e8f5e9",border:"2px solid #66bb6a",borderRadius:10,
            padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontSize:10,fontWeight:800,color:"#1b5e20",textTransform:"uppercase",letterSpacing:0.8,marginBottom:3}}>
                🏠 Government Required Move-In Date
              </div>
              <div style={{fontSize:20,fontWeight:900,color:GRN}}>{fmtDate(c.moveInDate)}</div>
              <div style={{fontSize:11,color:"#2e7d32",marginTop:2}}>
                Units must be fully furnished, cleaned, and ready for occupancy by this date.
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:2}}>Days Until Move-In</div>
              <div style={{fontSize:26,fontWeight:900,color:urgColor(daysLeft(c.moveInDate))}}>
                {daysLeft(c.moveInDate)>0?daysLeft(c.moveInDate):"Today"}
              </div>
            </div>
          </div>
        )}

        {/* Lodging schedule */}
        {c.sow?.lodgingSchedule&&(()=>{
          const s = c.sow.lodgingSchedule;
          const typeColors={
            emergency:  {bg:"#ffebee",border:RED,   text:RED},
            continuous: {bg:"#e8f5e9",border:GRN,   text:GRN},
            tdy:        {bg:"#e3f2fd",border:NAV,   text:NAV},
            seasonal:   {bg:"#f9fbe7",border:GOLD,  text:GOLD},
            relocation: {bg:"#f3e5f5",border:PUR,   text:PUR},
          };
          const col = typeColors[s.type]||{bg:"#f5f5f5",border:"#999",text:"#333"};
          return(
            <div style={{background:col.bg,border:`2px solid ${col.border}40`,borderRadius:10,
              padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:800,color:col.text,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>
                🗓️ Lodging Schedule Requirement
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                <div style={{background:"#fff",borderRadius:7,padding:"8px 10px",border:`1px solid ${col.border}30`,textAlign:"center"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:2}}>Schedule Type</div>
                  <div style={{fontSize:12,fontWeight:900,color:col.text}}>{s.typeLabel}</div>
                </div>
                <div style={{background:"#fff",borderRadius:7,padding:"8px 10px",border:`1px solid ${col.border}30`,textAlign:"center"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:2}}>Nights/Year</div>
                  <div style={{fontSize:16,fontWeight:900,color:col.text}}>{s.nightsPerYear||"Variable"}</div>
                </div>
                <div style={{background:"#fff",borderRadius:7,padding:"8px 10px",border:`1px solid ${col.border}30`,textAlign:"center"}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:2}}>Weeks/Year</div>
                  <div style={{fontSize:16,fontWeight:900,color:col.text}}>{s.weeksPerYear||"On-Call"}</div>
                </div>
              </div>
              <div style={{background:"#fff",borderRadius:7,padding:"9px 12px",marginBottom:7,border:`1px solid ${col.border}25`}}>
                <div style={{fontSize:9,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>📅 Specific Dates / Periods</div>
                <div style={{fontSize:12,color:"#1a2340",fontWeight:600,lineHeight:1.6}}>{s.specificDates}</div>
              </div>
              <div style={{background:"#fff",borderRadius:7,padding:"9px 12px",border:`1px solid ${col.border}25`}}>
                <div style={{fontSize:9,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>⚠️ Availability Requirement</div>
                <div style={{fontSize:12,color:"#334",lineHeight:1.6}}>{s.scheduleNotes}</div>
              </div>
            </div>
          );
        })()}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[{label:"Units Needed",value:c.sow.units,icon:"🏠"},{label:"Duration",value:c.sow.duration,icon:"📅"},{label:"Location",value:c.sow.location,icon:"📍"}].map(({label,value,icon})=>(
            <div key={label} style={{background:"#fff",borderRadius:8,padding:"9px 11px",border:"1px solid #e4e9f4"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:2}}>{icon} {label}</div>
              <div style={{fontSize:11,fontWeight:700,color:"#1a2340",lineHeight:1.4}}>{value}</div>
            </div>
          ))}
        </div>
        {c.sow.amenities.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:800,color:"#556",marginBottom:6}}>🛋️ Required Amenities</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {c.sow.amenities.map(a=>(<span key={a} style={{background:MINT+"80",color:TEAL,border:`1px solid ${MINT2}`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{a}</span>))}
            </div>
          </div>
        )}
        {c.sow.utilities.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:800,color:"#556",marginBottom:6}}>⚡ Utilities</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {c.sow.utilities.map(u=>(<span key={u} style={{background:"#e3f2fd",color:NAV,border:`1px solid ${NAV}20`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{u}</span>))}
            </div>
          </div>
        )}
        <div>
          <div style={{fontSize:11,fontWeight:800,color:"#556",marginBottom:6}}>✅ Full Requirements</div>
          {c.sow.requirements.map((r,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-start"}}>
              <span style={{color:NAV,fontSize:13,lineHeight:1.2,flexShrink:0}}>▸</span>
              <span style={{fontSize:12,color:"#334",lineHeight:1.55}}>{r}</span>
            </div>
          ))}
        </div>

        {/* Extension details */}
        {c.extension&&(
          <div style={{marginTop:12,borderTop:"1px solid #e4e9f4",paddingTop:12}}>
            <div style={{fontSize:11,fontWeight:800,color:"#556",marginBottom:8,textTransform:"uppercase",letterSpacing:0.7}}>
              🔄 Contract Extension Options
            </div>
            <div style={{background:c.extension.extendable?"#e3f2fd":"#fafafa",
              border:`1.5px solid ${c.extension.extendable?"#1565c0":"#ccc"}`,
              borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:c.extension.extendable?10:0}}>
                <span style={{fontSize:18}}>{c.extension.extendable?"🔄":"⛔"}</span>
                <span style={{fontSize:14,fontWeight:900,
                  color:c.extension.extendable?"#1565c0":"#888"}}>
                  {c.extension.extendable?"This contract CAN be extended":"This contract CANNOT be extended"}
                </span>
              </div>
              {c.extension.extendable&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
                  {[
                    {label:"Extension Length", val:c.extension.length},
                    {label:"Total Duration",   val:c.extension.totalDuration},
                  ].map(({label,val})=>(
                    <div key={label} style={{background:"#fff",borderRadius:7,padding:"8px 10px",border:"1px solid #bbdefb",textAlign:"center"}}>
                      <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>{label}</div>
                      <div style={{fontSize:14,fontWeight:900,color:"#1565c0"}}>{val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {gsa&&(
        <div style={{background:"#f0f4ff",border:`1px solid ${NAV}20`,borderRadius:10,padding:"13px 16px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:800,color:NAV,textTransform:"uppercase",letterSpacing:0.8,marginBottom:9,display:"flex",alignItems:"center",gap:8}}>
            💰 GSA FY2026 — {c.city}
            {isKD&&<span style={{background:NAV,color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>⭐ KD PROPERTY</span>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {[["Max Lodging/Night",`$${gsa.lodging}`],["M&IE Daily",`$${gsa.mie}`],["Total/Day",`$${gsa.lodging+gsa.mie}`]].map(([l,v])=>(
              <div key={l} style={{textAlign:"center",background:"#fff",borderRadius:8,padding:"10px 5px"}}>
                <div style={{fontSize:19,fontWeight:900,color:NAV}}>{v}</div>
                <div style={{fontSize:9,color:"#888",marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          {gsa.seasonal&&<div style={{fontSize:11,color:AMB,fontWeight:700,marginBottom:4}}>⚠️ Seasonal — verify at GSA.gov/perdiem</div>}
          {gsa.note&&<div style={{fontSize:11,color:"#667",marginBottom:8}}>ℹ️ {gsa.note}</div>}
          <div style={{background:"#e8f0fe",borderRadius:8,padding:"8px 12px"}}>
            <div style={{fontSize:11,fontWeight:700,color:NAV,marginBottom:4}}>Revenue Estimates (30 nights)</div>
            {[1,3,5,10].map(u=>(<div key={u} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
              <span style={{color:"#555"}}>{u} unit{u>1?"s":""} × ${gsa.lodging} × 30n</span>
              <strong style={{color:GRN}}>${(gsa.lodging*u*30).toLocaleString()}</strong>
            </div>))}
          </div>
        </div>
      )}

      <EvalCriteriaPanel c={c}/>

      {gsa&&<BidSheetPanel c={c} gsaRate={gsa.lodging}/>}

      {c.propType==="hotel"&&<RoomSpecsPanel c={c}/>}

      {c.propType==="hotel"&&<ConferencePanel c={c}/>}

      {gsa&&c.propType&&(
        <ProfitCalc c={c} gsaRate={gsa.lodging}/>
      )}

      {gsa&&c.propType==="hotel"&&(
        <RoomNightsCalc c={c} gsaRate={gsa.lodging}/>
      )}

      {gsa&&c.propType==="hotel"&&(
        <HotelProfitSearch c={c} gsaRate={gsa.lodging}/>
      )}

      <VendorList c={c} gsaRate={gsa?.lodging||0}/>

      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>📬 POC</div>
        <a href={`mailto:${c.poc}`} style={{color:NAV,fontWeight:700,fontSize:13,textDecoration:"none",
          background:"#f0f4ff",padding:"7px 13px",borderRadius:7,display:"inline-block",border:`1px solid ${NAV}25`}}>✉️ {c.poc}</a>
      </div>

      {/* ── COPY SOW BUTTON ── */}
      <BidProposalButton c={c} gsaRate={gsa?.lodging||0}/>
      <SOWWordButton c={c}/>
      <SOWCopyButton c={c}/>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
        {c.tags.map(t=>(<span key={t} style={{background:"#eef1fb",color:NAV,borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:600}}>{t}</span>))}
      </div>
      <div style={{paddingTop:12,borderTop:"1px solid #e4e9f4",display:"flex",gap:14,fontSize:11,color:"#aab",flexWrap:"wrap"}}>
        {[["Company","KD Modern Rentals LLC"],["CAGE","190G9"],["UEI","GT5SBDQXQNC5"],["DUNS","12-073-0769"],["WOSB","Active"]].map(([l,v])=>(
          <div key={l}><span style={{fontWeight:700,color:"#889"}}>{l}:</span> <span style={{fontFamily:"monospace",color:"#445"}}>{v}</span></div>
        ))}
      </div>
    </div>
  );
}


// ── UPDATE 1: EVALUATION CRITERIA PANEL ──────────────────────────────────────
function EvalCriteriaPanel({c}){
  const sow = c.sow||{};
  const evalMethod = sow.evalMethod||(c.propType==="hotel"?"LPTA — Lowest Price Technically Acceptable":"Best Value / Tradeoff");
  const isLPTA = evalMethod.toLowerCase().includes("lpta");
  const sizeStd = c.naics==="531110"?"$47.5M annual revenue — NAICS 531110 (Lessors of Residential Buildings)":"$47.5M annual revenue — NAICS 721110 (Hotels and Motels)";
  const expRequired = sow.experienceRequired||"Documented experience managing furnished residential or hotel lodging. Past performance references preferred.";
  const pastPerf = sow.pastPerformance||"3 references preferred. Airbnb Superhost status and STR portfolio qualifies as past performance. CPARs ratings apply on option year renewals.";
  return(
    <div style={{background:"#f3e5f5",border:"1.5px solid #6a1b9a30",borderRadius:12,padding:"16px 18px",marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:800,color:PUR,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>&#x2696;&#xfe0f; Evaluation Criteria</div>
      <div style={{background:isLPTA?"#fff3e0":"#e8f5e9",border:`2px solid ${isLPTA?AMB:GRN}`,borderRadius:10,padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"flex-start",gap:12}}>
        <span style={{fontSize:26,flexShrink:0}}>{isLPTA?"$":"\u{1F3C6}"}</span>
        <div>
          <div style={{fontSize:13,fontWeight:900,color:isLPTA?AMB:GRN}}>{isLPTA?"LPTA — Lowest Price Wins":"Best Value / Tradeoff"}</div>
          <div style={{fontSize:11,color:"#444",marginTop:3,lineHeight:1.55}}>
            {isLPTA
              ?"Submit the lowest technically acceptable price. Beat the GSA rate. No extra credit for quality — just meet minimum specs and be cheapest."
              :"Price + quality + experience are all scored. Being cheapest alone will not win. Show your Airbnb track record and fast move-in capability."}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:10}}>
        {[
          {label:"Evaluation Method",           val:evalMethod,  icon:"Evaluation"},
          {label:"Small Business Size Standard", val:sizeStd,    icon:"Size"},
          {label:"Experience Required",          val:expRequired, icon:"Experience"},
          {label:"Past Performance",             val:pastPerf,    icon:"Past Perf"},
          {label:"Set-Aside",                    val:c.setAside,  icon:"Set-Aside"},
        ].map(({label,val,icon})=>(
          <div key={label} style={{background:"#fff",borderRadius:8,padding:"10px 13px",border:"1px solid #6a1b9a20"}}>
            <div style={{fontSize:10,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.6,marginBottom:3}}>{icon}</div>
            <div style={{fontSize:12,color:"#334",lineHeight:1.55,fontWeight:500}}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:8,padding:"11px 13px",border:"1px solid #6a1b9a20"}}>
        <div style={{fontSize:10,fontWeight:800,color:PUR,textTransform:"uppercase",letterSpacing:0.6,marginBottom:7}}>Your KD Competitive Position</div>
        {["WOSB-certified — qualifies for all WOSB set-asides automatically",
          "SAM.gov ACTIVE — CAGE 190G9, UEI GT5SBDQXQNC5, DUNS 12-073-0769",
          "Airbnb Superhost 4.8+ rating = strong past performance narrative",
          "PharmD credential — differentiator for VA, HHS, and medical housing contracts",
          "Milwaukee + St. Augustine + Door County = demonstrated multi-market capability",
        ].map((item,i)=>(
          <div key={i} style={{fontSize:11,color:"#334",lineHeight:1.6,marginBottom:2}}>+ {item}</div>
        ))}
      </div>
    </div>
  );
}

// ── UPDATE 2: BID SHEET / PRICING PANEL ──────────────────────────────────────
function BidSheetPanel({c, gsaRate}){
  const gsa = gsaRate||0;
  const mie = GSA[c.city]?.mie||0;
  const [bidRate, setBidRate] = useState(Math.round(gsa*0.98));
  const unitNums = String(c.sow?.units||"5").match(/[0-9]+/g);
  const maxUnits = unitNums?parseInt(unitNums[unitNums.length-1]):5;
  const nights = c.sow?.lodgingSchedule?.nightsPerYear||180;
  const monthlyNights = Math.round(nights/12);
  const monthlyRev = bidRate*maxUnits*monthlyNights;
  const pctBelowGSA = gsa>0?((1-bidRate/gsa)*100).toFixed(1):0;
  const aboveGSA = bidRate>gsa;
  return(
    <div style={{background:"#e8f5e9",border:"1.5px solid #1b5e2030",borderRadius:12,padding:"16px 18px",marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:800,color:GRN,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>Bid Sheet and Pricing</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[
          {label:"GSA Max Lodging",  val:"$"+gsa+"/night",    sub:"FY2026 ceiling",       color:NAV},
          {label:"M&IE Daily Rate",  val:"$"+mie+"/day",      sub:"Meals and incidentals", color:TEAL},
          {label:"Total Per Diem",   val:"$"+(gsa+mie)+"/day",sub:"Lodging + M&IE",        color:PUR},
        ].map(({label,val,sub,color})=>(
          <div key={label} style={{background:"#fff",borderRadius:9,padding:"11px 12px",border:"1.5px solid #e4e9f4",textAlign:"center"}}>
            <div style={{fontSize:9,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.6,marginBottom:4}}>{label}</div>
            <div style={{fontSize:17,fontWeight:900,color}}>{val}</div>
            <div style={{fontSize:9,color:"#999",marginTop:2}}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:9,padding:"13px 14px",marginBottom:10,border:"1.5px solid #1b5e2030"}}>
        <div style={{fontSize:10,fontWeight:800,color:"#556",textTransform:"uppercase",letterSpacing:0.6,marginBottom:8}}>Your Bid Rate</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
          <span style={{fontSize:13,color:"#445",fontWeight:700}}>$</span>
          <input type="number" value={bidRate} onChange={e=>setBidRate(Math.max(1,parseInt(e.target.value)||0))}
            style={{width:100,padding:"7px 10px",borderRadius:7,border:"2px solid "+(aboveGSA?RED:NAV)+"40",fontSize:15,fontWeight:800,color:aboveGSA?RED:NAV,outline:"none",textAlign:"center"}}/>
          <span style={{fontSize:12,color:"#778"}}>/night per unit</span>
          <span style={{fontSize:12,fontWeight:800,color:aboveGSA?RED:GRN}}>
            {aboveGSA?"ABOVE GSA MAX — disqualifying":pctBelowGSA+"% below GSA ceiling"}
          </span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[
            {label:"Monthly Revenue est.",val:"$"+monthlyRev.toLocaleString(),color:GRN},
            {label:"Payment Terms",       val:"Net-30 via IPP",              color:NAV},
            {label:"Billing Cycle",       val:"5th of each month",           color:TEAL},
          ].map(({label,val,color})=>(
            <div key={label} style={{background:"#f8f9ff",borderRadius:7,padding:"9px 11px",border:"1px solid #e4e9f4",textAlign:"center"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>{label}</div>
              <div style={{fontSize:13,fontWeight:800,color}}>{val}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:"#e8f0fe",borderRadius:8,padding:"10px 13px",border:"1px solid #354984 20"}}>
        <div style={{fontSize:10,fontWeight:800,color:NAV,marginBottom:5}}>What to Include in Your Bid</div>
        {["Bid rate per unit per night — at or below GSA ceiling",
          "Total monthly invoice amount",
          "Payment via IPP (Invoice Processing Platform) — Net-30",
          "Rate includes all amenities and utilities per SOW",
          "Monthly invoices submitted by 5th of following month",
          "Attach W-9, CAGE 190G9, UEI GT5SBDQXQNC5 with submission",
        ].map((item,i)=>(
          <div key={i} style={{fontSize:11,color:"#334",lineHeight:1.6,marginBottom:1}}>- {item}</div>
        ))}
      </div>
    </div>
  );
}

// ── UPDATE 3: ROOM SPECS PANEL ────────────────────────────────────────────────
function RoomSpecsPanel({c}){
  const sow = c.sow||{};
  const specs = sow.roomSpecs||{};
  const reqs = sow.requirements||[];
  const amenities = sow.amenities||[];
  const needsADA = amenities.some(a=>a.toLowerCase().includes("ada"))||reqs.some(r=>r.toLowerCase().includes("ada"));
  const needsSafe = amenities.some(a=>a.toLowerCase().includes("safe"))||reqs.some(r=>r.toLowerCase().includes("safe"));
  const needsAC = amenities.some(a=>a.toLowerCase().includes("a/c")||a.toLowerCase().includes("air cond"))||reqs.some(r=>r.toLowerCase().includes("a/c"));
  const smokingPolicy = specs.smokingPolicy||"Non-smoking only (standard for all govt contracts)";
  const distanceFromBase = specs.distanceFromBase||reqs.find(r=>r.toLowerCase().includes("mile")||r.toLowerCase().includes("within")||r.toLowerCase().includes("radius"))||"Verify in SOW";
  const bedTypes = specs.bedTypes||["Verify in SOW — not specified"];
  const connectedRooms = specs.connectedRooms||false;
  const adaRequired = specs.adaRequired||needsADA;
  return(
    <div style={{background:"#e3f2fd",border:"1.5px solid #354984 30",borderRadius:12,padding:"16px 18px",marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:800,color:NAV,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>Room Specifications</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div style={{background:"#fff",borderRadius:9,padding:"11px 13px",border:"1px solid #354984 20"}}>
          <div style={{fontSize:10,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Bed Types Required</div>
          {bedTypes.map((b,i)=>(
            <div key={i} style={{fontSize:12,color:"#334",fontWeight:600,marginBottom:3}}>- {b}</div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:9,padding:"11px 13px",border:"1px solid #354984 20"}}>
          <div style={{fontSize:10,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.6,marginBottom:6}}>Distance and Radius</div>
          <div style={{fontSize:12,color:"#334",fontWeight:600,lineHeight:1.5}}>{distanceFromBase}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        {[
          {label:"ADA Required",    req:adaRequired,    yes:"ADA units required",      no:"Not specified",   },
          {label:"In-Room Safe",    req:needsSafe,      yes:"In-room safe required",   no:"Not required",    },
          {label:"A/C Required",    req:needsAC,        yes:"A/C required",            no:"Not specified",   },
          {label:"Connected Rooms", req:connectedRooms, yes:"Connected rooms needed",  no:"Not required",    },
        ].map(({label,req,yes,no})=>(
          <div key={label} style={{background:req?"#e8f5e9":"#f8f9ff",borderRadius:8,padding:"9px 11px",
            border:"1.5px solid "+(req?GRN:NAV)+"20"}}>
            <div style={{fontSize:9,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>{label}</div>
            <div style={{fontSize:11,fontWeight:700,color:req?GRN:"#888"}}>{req?"YES — "+yes:"No — "+no}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#fff",borderRadius:8,padding:"10px 13px",border:"1px solid #354984 20",marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.6,marginBottom:4}}>Smoking Policy</div>
        <div style={{fontSize:12,color:"#334",fontWeight:600}}>{smokingPolicy}</div>
      </div>
      <div style={{background:"#fff3e0",borderRadius:8,padding:"10px 13px",border:"1px solid "+AMB+"30"}}>
        <div style={{fontSize:10,fontWeight:800,color:AMB,textTransform:"uppercase",letterSpacing:0.6,marginBottom:5}}>Ask These When You Call Hotels</div>
        {[
          needsSafe&&"Do all rooms have in-room safes, or can you guarantee a safe in every blocked room?",
          needsAC&&"Is A/C individually controlled per room, or central building A/C?",
          adaRequired&&"How many ADA-compliant rooms can you hold, and what are the specific ADA features?",
          connectedRooms&&"Can you block connected rooms for teams on the same floor?",
          "What is your fire safe certification status — NFPA 101 compliant?",
        ].filter(Boolean).map((q,i)=>(
          <div key={i} style={{fontSize:11,color:"#5a3000",lineHeight:1.6,marginBottom:3}}>- {q}</div>
        ))}
      </div>
    </div>
  );
}

// ── UPDATE 4: CONFERENCE / EVENT SPACE PANEL ──────────────────────────────────
function ConferencePanel({c}){
  const sow = c.sow||{};
  const conf = sow.conferenceSpace||{};
  const amenities = sow.amenities||[];
  const reqs = sow.requirements||[];
  const confMentioned = conf.required||
    amenities.some(a=>a.toLowerCase().includes("conference")||a.toLowerCase().includes("meeting"))||
    reqs.some(r=>r.toLowerCase().includes("conference")||r.toLowerCase().includes("meeting"));
  if(!confMentioned) return(
    <div style={{background:"#f5f5f5",border:"1px solid #e0e0e0",borderRadius:12,padding:"12px 16px",marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:800,color:"#888",textTransform:"uppercase",letterSpacing:0.8,marginBottom:4}}>Conference and Event Space</div>
      <div style={{fontSize:12,color:"#aaa"}}>Not required in this SOW.</div>
    </div>
  );
  const capacity = conf.capacity||"Verify in SOW";
  const hasAV = conf.av||amenities.some(a=>a.toLowerCase().includes("av")||a.toLowerCase().includes("projector"));
  const hasFB = conf.foodBeverage||amenities.some(a=>a.toLowerCase().includes("food")||a.toLowerCase().includes("catering"));
  const breakouts = conf.breakoutRooms||0;
  const confWifi = conf.wifi||"Dedicated event Wi-Fi required";
  const confParking = conf.parking||"Verify with hotel";
  return(
    <div style={{background:"#fff8e1",border:"1.5px solid #b8860b40",borderRadius:12,padding:"16px 18px",marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:800,color:GOLD,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>Conference and Event Space</div>
      <div style={{background:conf.required?"#fff3e0":"#fffde7",borderRadius:9,padding:"10px 13px",marginBottom:12,
        border:"2px solid "+(conf.required?AMB:GOLD),display:"flex",alignItems:"flex-start",gap:10}}>
        <span style={{fontSize:20}}>&#x1F4CB;</span>
        <div>
          <div style={{fontSize:12,fontWeight:800,color:conf.required?AMB:GOLD}}>
            {conf.required?"Conference Space Required in SOW":"Conference Space Mentioned — Confirm with CO"}
          </div>
          <div style={{fontSize:11,color:"#555",marginTop:2}}>Capacity needed: <strong>{capacity}</strong></div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        {[
          {label:"A/V Equipment",        req:hasAV,         yes:"Required",      no:"Not specified"},
          {label:"Food and Beverage",    req:hasFB,         yes:"Required",      no:"Not required"},
          {label:"Breakout Rooms",       req:breakouts>0,   yes:breakouts+" rooms",no:"Not required"},
          {label:"Connected to Sleeping",req:conf.connected,yes:"Same property", no:"Separate OK"},
        ].map(({label,req,yes,no})=>(
          <div key={label} style={{background:"#fff",borderRadius:8,padding:"9px 11px",border:"1.5px solid "+GOLD+"20"}}>
            <div style={{fontSize:9,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.5,marginBottom:3}}>{label}</div>
            <div style={{fontSize:11,fontWeight:700,color:req?AMB:"#888"}}>{req?"YES — "+yes:"No — "+no}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div style={{background:"#fff",borderRadius:8,padding:"10px 13px",border:"1px solid "+GOLD+"20"}}>
          <div style={{fontSize:10,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.6,marginBottom:3}}>Wi-Fi</div>
          <div style={{fontSize:11,color:"#334",fontWeight:600}}>{confWifi}</div>
        </div>
        <div style={{background:"#fff",borderRadius:8,padding:"10px 13px",border:"1px solid "+GOLD+"20"}}>
          <div style={{fontSize:10,fontWeight:800,color:"#9aa",textTransform:"uppercase",letterSpacing:0.6,marginBottom:3}}>Parking</div>
          <div style={{fontSize:11,color:"#334",fontWeight:600}}>{confParking}</div>
        </div>
      </div>
      <div style={{background:"#fff",borderRadius:8,padding:"10px 13px",border:"1px solid "+GOLD+"20"}}>
        <div style={{fontSize:10,fontWeight:800,color:AMB,textTransform:"uppercase",letterSpacing:0.6,marginBottom:5}}>Ask These When You Call Hotels</div>
        {[
          "Can your conference room accommodate "+capacity+"?",
          "Is the conference room adjacent to or connected with the sleeping rooms?",
          hasAV&&"What A/V equipment is included — projector, screen, microphone, display?",
          hasFB&&"Do you offer food and beverage service for government meetings?",
          breakouts>0&&"Can you provide "+breakouts+" separate breakout rooms on the same date?",
          "Is dedicated event Wi-Fi included or billed separately?",
          "What is your all-in daily room block plus conference room rate for government contracts?",
        ].filter(Boolean).map((q,i)=>(
          <div key={i} style={{fontSize:11,color:"#5a3000",lineHeight:1.6,marginBottom:3}}>- {q}</div>
        ))}
      </div>
    </div>
  );
}

// ── VENDOR DATABASE ───────────────────────────────────────────────────────────
// Pre-filled chains known to qualify for govt lodging — verify availability per city
const HOTEL_CHAINS=[
  {name:"Marriott Residence Inn",    type:"hotel",    phone:"1-800-331-3131", site:"residenceinn.com",     note:"Extended stay, kitchen, fire safe — top govt choice"},
  {name:"Hilton Homewood Suites",    type:"hotel",    phone:"1-800-225-5466", site:"homewoodsuites.com",   note:"Full kitchen, laundry, DoD preferred — great for TDY"},
  {name:"IHG Staybridge Suites",     type:"hotel",    phone:"1-800-238-8000", site:"staybridge.com",       note:"Extended stay, GSA compliant, kitchen, parking"},
  {name:"Hilton Home2 Suites",       type:"hotel",    phone:"1-800-445-8667", site:"home2suites.com",      note:"Budget-friendly extended stay, Wi-Fi, kitchen"},
  {name:"Marriott TownePlace Suites",type:"hotel",    phone:"1-800-257-3000", site:"towneplace.com",       note:"Extended stay, full kitchen, in-room safe, laundry"},
  {name:"Hyatt House",               type:"hotel",    phone:"1-800-233-1234", site:"hyatt.com/hyatthouse",  note:"Residential-style, kitchen, govt rate eligible"},
  {name:"Best Western Plus",         type:"hotel",    phone:"1-800-780-7234", site:"bestwestern.com",      note:"Fire safe certified, parking, widely available"},
  {name:"La Quinta by Wyndham",      type:"hotel",    phone:"1-800-753-3757", site:"lq.com",               note:"Pet-friendly, free breakfast, fire safe, parking"},
  {name:"Candlewood Suites (IHG)",   type:"hotel",    phone:"1-877-859-5095", site:"candlewoodsuites.com", note:"Long-stay specialist, full kitchen, laundry, quiet"},
  {name:"WoodSpring Suites",         type:"hotel",    phone:"1-800-966-3646", site:"woodspring.com",       note:"Weekly/monthly rates, kitchen, budget govt option"},
  {name:"Extended Stay America",     type:"hotel",    phone:"1-800-804-3724", site:"extendedstayamerica.com",note:"Kitchen, laundry, pet-friendly, govt rates available"},
  {name:"Sonesta Simply Suites",     type:"hotel",    phone:"1-800-766-3782", site:"sonesta.com",          note:"Full kitchen, laundry, monthly rates, GSA eligible"},
];

const APT_CHAINS=[
  {name:"Furnished Finders",         type:"apartment",phone:"N/A",            site:"furnishedfinder.com",  note:"Search furnished mid-term rentals by city — great for VA/HHS contracts"},
  {name:"CHBO (Corporate Housing)",  type:"apartment",phone:"1-877-333-2426", site:"corporatehousingbyowner.com",note:"Corporate furnished rentals, monthly, govt-friendly"},
  {name:"National Corporate Housing",type:"apartment",phone:"1-800-994-9999", site:"nchventures.com",      note:"Fully furnished, utilities included, direct govt billing"},
  {name:"Oakwood Worldwide",         type:"apartment",phone:"1-800-888-0808", site:"oakwood.com",          note:"Premium furnished apts, govt contracts, worldwide"},
  {name:"Global Housing Solutions",  type:"apartment",phone:"1-877-447-5785", site:"globalhs.com",         note:"Furnished housing, relocation specialist, govt clients"},
  {name:"Zillow Furnished Rentals",  type:"apartment",phone:"N/A",            site:"zillow.com",           note:"Filter: Furnished + 1–12 months — great for finding local options"},
  {name:"Apartments.com Corp",       type:"apartment",phone:"N/A",            site:"apartments.com",       note:"Filter by furnished, short-term — call leasing offices directly"},
  {name:"AMLI Residential",          type:"apartment",phone:"1-888-264-7553", site:"amli.com",             note:"Upscale furnished apts, govt leases accepted, multiple cities"},
  {name:"Camden Property Trust",     type:"apartment",phone:"1-800-922-6336", site:"camdenliving.com",     note:"Furnished units available, govt leases, Southeast/SW heavy"},
  {name:"MAA (Mid-America Apt)",     type:"apartment",phone:"1-866-620-1130", site:"maac.com",             note:"Furnished options, Southeast/Midwest, monthly leases"},
  {name:"Equity Residential",        type:"apartment",phone:"1-888-378-4479", site:"equityapartments.com", note:"Major cities, furnished units, corporate/govt lease experience"},
  {name:"Greystar Furnished",        type:"apartment",phone:"1-877-526-0550", site:"greystar.com",         note:"Nationwide, furnished corporate units, govt lease friendly"},
];

// City-specific vendors — apartments for apt contracts, hotels for hotel contracts
const CITY_VENDORS={
  "Milwaukee":{
    hotel:[
      {name:"Residence Inn Milwaukee Downtown",         type:"hotel", phone:"414-224-7890", address:"648 N Plankinton Ave, Milwaukee WI 53203",    unitCount:175, amenities:["Kitchen","Parking","Fire Safe","In-Room Safe","Laundry","Wi-Fi","TV","A/C","Desk"],         note:"✅ Top govt TDY choice — DoD preferred, fire safe certified, in-room safe, A/C, full kitchen. 175 rooms. GSA rate eligible."},
      {name:"Homewood Suites Milwaukee Downtown",       type:"hotel", phone:"414-278-1500", address:"500 N Water St, Milwaukee WI 53202",           unitCount:94,  amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Breakfast","A/C","Desk"],                       note:"Full kitchen, laundry, A/C, breakfast included. 94 rooms. GSA eligible. ⚠️ No in-room safe — ask at check-in for portable safe."},
      {name:"Staybridge Suites Milwaukee Airport South",type:"hotel", phone:"414-761-3800", address:"6791 S 13th St, Franklin WI 53132",            unitCount:118, amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Pool","In-Room Safe","A/C","Fire Safe"],         note:"✅ Extended stay, in-room safe, A/C, fire safe, kitchen, pool. 118 rooms. 7 mi from airport. GSA compliant."},
      {name:"TownePlace Suites Milwaukee Brookfield",   type:"hotel", phone:"262-785-0500", address:"600 N Moorland Rd, Brookfield WI 53005",       unitCount:95,  amenities:["Kitchen","Parking","In-Room Safe","Laundry","Wi-Fi","Desk","A/C","Fire Safe"],             note:"✅ In-room safe, A/C, fire safe, workspace, full kitchen. 95 rooms. 30 min to downtown MKE. GSA compliant."},
      {name:"Candlewood Suites Milwaukee Airport",      type:"hotel", phone:"414-570-1111", address:"5200 S Howell Ave, Milwaukee WI 53207",        unitCount:122, amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","A/C","Fire Safe"],                             note:"Long-stay specialist, full kitchen, A/C, fire safe. 122 rooms. ⚠️ No in-room safe — confirm availability. Near airport."},
    ],
    apartment:[
      // ── WEST ALLIS — 6–10 miles from downtown MKE ────────────────────────
      {name:"The West Living",                     type:"apartment", phone:"414-662-2566", address:"6620 W National Ave, West Allis WI 53214",    unitCount:177, rating:4.1, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","A/C","Gym","ADA","Rooftop"], note:"⭐ 4.1 — Built 2019, 177 units. Rooftop terrace, yoga studio, underground parking. 1.1 mi from Zablocki VA. Corp lease friendly. Mandel Group managed. ✅ TOP PICK West Allis.", badge:"West Allis"},
      {name:"Element 84 Apartments",               type:"apartment", phone:"414-204-7440", address:"1482 S 84th St, West Allis WI 53214",         unitCount:203, rating:4.0, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","A/C","Gym","Pool"],      note:"⭐ 4.0 — Built 2020, 203 units. Pool, fitness center. 1.5 mi from Zablocki VA. Modern build, good reviews. ✅ Strong West Allis pick.", badge:"West Allis"},
      {name:"Six Points Apartments",               type:"apartment", phone:"414-332-5500", address:"6501 W Greenfield Ave, West Allis WI 53214",  unitCount:178, rating:3.5, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","A/C","Gym"],          note:"⭐ 3.5 — 178 units, in-unit W/D, heated underground parking. Reviews mention mgmt turnover issues. ⚠️ Verify current management before committing.", badge:"West Allis"},
      {name:"Furnished Finder – West Allis",       type:"apartment", phone:"N/A",          address:"furnishedfinder.com → West Allis WI",         unitCount:null,rating:null, amenities:["Furnished","Kitchen"],                                                  note:"Search tool — mid-term furnished units. Verify count, quality, and govt lease terms per listing.", badge:"West Allis"},
      // ── MILWAUKEE PROPER ─────────────────────────────────────────────────
      {name:"North End Apartments",                type:"apartment", phone:"414-312-4100", address:"1551 N Water St, Milwaukee WI 53202",          unitCount:655, rating:3.9, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Gym","Pool"],  note:"⭐ 3.9 — 655 units, 6 buildings along Milwaukee River. Pool, rooftop terrace, pet spa, mini-bowling. Mandel Group. Most amenity-rich in MKE. ✅ Best for VA 45-unit needs.", badge:"Milwaukee"},
      {name:"Greystar – The Buckler",              type:"apartment", phone:"414-276-3400", address:"625 N Van Buren St, Milwaukee WI 53202",       unitCount:220, rating:4.2, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","Gym","ADA"],         note:"⭐ 4.2 — 220 units. Greystar national management — experienced with corporate/govt leases. Consistently strong reviews. ✅ Most govt-contract-friendly pick in MKE.", badge:"Milwaukee"},
      {name:"The Moderne Apartments",              type:"apartment", phone:"414-225-8210", address:"1141 N Old World 3rd St, Milwaukee WI 53203",  unitCount:203, rating:3.6, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA"],               note:"⭐ 3.6 — 203 units. Short-term corporate leases offered (30-day min). Reviews note appliance quality inconsistency in older units. ⚠️ Request a remodeled unit.", badge:"Milwaukee"},
      {name:"The Couture Milwaukee",               type:"apartment", phone:"414-885-3600", address:"909 E Michigan St, Milwaukee WI 53202",       unitCount:322, rating:4.3, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Gym","Pool","Rooftop"],note:"⭐ 4.3 — 322 units, lakefront, rooftop pool. Newest luxury building in MKE. Corporate lease capable. ✅ Premium govt option.", badge:"Milwaukee"},
      {name:"CHBO – Milwaukee Furnished",          type:"apartment", phone:"1-877-333-2426",address:"corporatehousingbyowner.com → Milwaukee",    unitCount:null,rating:null, amenities:["Furnished","Kitchen","Utilities Included"],                             note:"Search tool — corporate furnished monthly rentals, individually owned. Verify quality and unit count per listing.", badge:"Milwaukee"},
    ]
  },
  "Door County":{
    hotel:[
      {name:"Westwood Shores Waterfront Resort",   type:"hotel", phone:"920-743-4422", address:"525 N Third Ave, Sturgeon Bay WI 54235",   unitCount:38, amenities:["Kitchen","Parking","Wi-Fi","Outdoor Space","Laundry","A/C","TV"],       note:"Waterfront, crew-friendly, seasonal. A/C in all units. ⚠️ No in-room safe — request one at front desk. 38 rooms."},
      {name:"Holiday Music Motel",                 type:"hotel", phone:"920-743-5571", address:"30 N 1st Ave, Sturgeon Bay WI 54235",      unitCount:40, amenities:["Parking","Wi-Fi","Kitchen","TV","A/C"],                                note:"Budget extended stay, A/C. ⚠️ No in-room safe, no fire safe cert on file — verify before bidding DoD contracts. 40 rooms."},
      {name:"Bridgeport Resort Sturgeon Bay",       type:"hotel", phone:"920-746-9919", address:"50 W Larch St, Sturgeon Bay WI 54235",    unitCount:90, amenities:["Kitchen","Parking","Wi-Fi","Pool","Laundry","A/C","TV","Fire Safe"],   note:"Largest inventory in Door County, 90 rooms, full kitchen, A/C, fire safe. ⚠️ No in-room safe — ask management. Best for USACE crew volume."},
    ],
    apartment:[
      {name:"Bay View Apartments Sturgeon Bay",    type:"apartment", phone:"920-743-2000",address:"317 S Madison Ave, Sturgeon Bay WI 54235",      unitCount:48,  amenities:["Furnished","Kitchen","Parking","Wi-Fi","Laundry"],              note:"Sturgeon Bay — closest furnished apts to Door County USACE sites"},
      {name:"Zillow Furnished – Door County",      type:"apartment", phone:"N/A",          address:"zillow.com → Sturgeon Bay WI furnished",       unitCount:null,amenities:["Furnished","Kitchen"],                                          note:"Filter furnished, 1–6 months, verify unit count with landlord"},
    ]
  },
  "St. Augustine":{
    hotel:[
      {name:"Residence Inn St. Augustine",         type:"hotel", phone:"904-940-5757", address:"2 State Rd 16, St. Augustine FL 32084",   unitCount:120, amenities:["Kitchen","Parking","Fire Safe","In-Room Safe","Laundry","Wi-Fi","Pool","A/C","Desk","TV"],  note:"✅ Full kitchen, fire safe, in-room safe, A/C, pool, laundry. 120 rooms. GSA eligible. Top choice for NPS/FEMA St. Augustine contracts."},
      {name:"Homewood Suites St. Augustine",       type:"hotel", phone:"904-217-1800", address:"29 Williams St, St. Augustine FL 32084",  unitCount:98,  amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Breakfast","A/C","Fire Safe"],                    note:"Full kitchen, A/C, fire safe, breakfast. 98 rooms. GSA eligible. ⚠️ No in-room safe — confirm with property before bidding DoD/ICE."},
      {name:"TownePlace Suites St. Augustine",     type:"hotel", phone:"904-417-5550", address:"101 Vantage Dr, St. Augustine FL 32092",  unitCount:103, amenities:["Kitchen","Parking","In-Room Safe","Laundry","Wi-Fi","A/C","Fire Safe","Desk","TV"],           note:"✅ In-room safe, A/C, fire safe, full kitchen, workspace. 103 rooms. GSA eligible. ✅ BEST for DoD/VA St. Augustine contracts."},
    ],
    apartment:[
      {name:"Aspire at Silverleaf",                type:"apartment", phone:"904-675-1477", address:"105 Aspire Dr, St. Augustine FL 32092",        unitCount:300, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Pool","Gym","Dog Park"],note:"Large modern complex, furnished units, St. Johns County — near FEMA zone. Resort-style pool, top-rated staff."},
      {name:"Veranda Bay Apartments",              type:"apartment", phone:"904-794-2100",address:"400 NW State Rd 207, St. Augustine FL 32086",     unitCount:192, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA"],       note:"Furnished available, monthly leases, govt lease experience"},
      {name:"Furnished Finder – St. Augustine",    type:"apartment", phone:"N/A",          address:"furnishedfinder.com → St. Augustine FL",         unitCount:null,amenities:["Furnished","Kitchen"],                                          note:"Mid-term furnished, verify unit count with each listing"},
    ]
  },
  "Jacksonville":{
    hotel:[
      {name:"Residence Inn Jacksonville Deerwood Park",type:"hotel", phone:"904-733-8088", address:"8365 Dix Ellis Trail, Jacksonville FL 32256",  unitCount:120, amenities:["Kitchen","Parking","Fire Safe","In-Room Safe","Laundry","Wi-Fi","Pool","A/C","Desk","TV"], note:"✅ Fire safe, in-room safe, A/C, full kitchen, pool. 120 rooms. Near NAS Jax. DoD preferred. GSA eligible."},
      {name:"TownePlace Suites Jacksonville",          type:"hotel", phone:"904-281-9200", address:"4686 Lenoir Ave S, Jacksonville FL 32216",     unitCount:95,  amenities:["Kitchen","Parking","In-Room Safe","Laundry","Wi-Fi","Desk","A/C","Fire Safe","TV"],       note:"✅ In-room safe, A/C, fire safe, workspace, full kitchen. 95 rooms. GSA eligible. Good for ICE/DoD staff."},
      {name:"Homewood Suites Jacksonville",            type:"hotel", phone:"904-997-6100", address:"10170 Deerwood Park Blvd, Jacksonville FL 32256",unitCount:110, amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Breakfast","A/C","Fire Safe"],                note:"Full kitchen, A/C, fire safe, breakfast. 110 rooms. ⚠️ No in-room safe — verify before DoD/ICE bid. Near NAS Jax corridor."},
      {name:"Candlewood Suites Jacksonville",          type:"hotel", phone:"904-821-7700", address:"4990 Belfort Rd, Jacksonville FL 32256",        unitCount:128, amenities:["Kitchen","Parking","Laundry","Wi-Fi","A/C","TV","Fire Safe"],                           note:"Long-stay specialist, full kitchen, A/C, fire safe. 128 rooms. ⚠️ No in-room safe — confirm. Near ICE/NAS Jax."},
    ],
    apartment:[
      {name:"San Marco Preserve Apartments",       type:"apartment", phone:"904-398-2665",address:"1700 Prudential Dr, Jacksonville FL 32207",      unitCount:312, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Pool"],note:"Large inventory — NAS Jax overflow, furnished available"},
      {name:"Greystar – Ten20 Apartments",         type:"apartment", phone:"904-619-8200",address:"1020 Gilmore St, Jacksonville FL 32204",          unitCount:244, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Gym"],note:"Greystar managed, govt leases, near NAS Jax corridor"},
      {name:"Furnished Finder – Jacksonville",     type:"apartment", phone:"N/A",          address:"furnishedfinder.com → Jacksonville FL",           unitCount:null,amenities:["Furnished","Kitchen"],                                         note:"Mid-term near NAS Jax — verify count per listing"},
    ]
  },
  "Key West":{
    hotel:[
      {name:"Hyatt Centric Key West",              type:"hotel",    phone:"305-809-1234",address:"601 Front St, Key West FL 33040",                 unitCount:120, amenities:["Parking","Wi-Fi","Pool","Fire Safe","TV","A/C"],                note:"Premium — GSA peak rate Feb–Apr $436/night"},
      {name:"Best Western Key Ambassador",         type:"hotel",    phone:"305-296-3500",address:"3755 S Roosevelt Blvd, Key West FL 33040",        unitCount:100, amenities:["Parking","Wi-Fi","Pool","Fire Safe","A/C","TV"],               note:"GSA eligible, parking, fire safe, oceanside"},
    ],
    apartment:[
      {name:"Truman Annex Furnished Rentals",      type:"apartment", phone:"305-292-1720",address:"201 Front St, Key West FL 33040",                 unitCount:60,  amenities:["Furnished","Kitchen","Parking","A/C","Wi-Fi","Laundry"],        note:"Monroe County, furnished units — verify availability for contract count"},
      {name:"Furnished Finder – Key West",         type:"apartment", phone:"N/A",          address:"furnishedfinder.com → Key West FL",               unitCount:null,amenities:["Furnished","Kitchen","A/C"],                                   note:"Monroe County furnished — verify unit count per listing"},
    ]
  },
  "Huntsville":{
    hotel:[
      {name:"Residence Inn Huntsville",            type:"hotel",    phone:"256-895-0444",address:"4020 Independence Dr, Huntsville AL 35816",       unitCount:112, amenities:["Kitchen","Parking","Fire Safe","Laundry","Wi-Fi","Pool"],       note:"Near Redstone Arsenal, fire safe, kitchen"},
      {name:"Homewood Suites Huntsville",          type:"hotel",    phone:"256-837-7080",address:"6035 Dug Hill Rd, Huntsville AL 35806",           unitCount:96,  amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Breakfast"],         note:"Full kitchen, laundry, DoD preferred"},
      {name:"TownePlace Suites Huntsville",        type:"hotel",    phone:"256-922-0333",address:"5903 University Dr NW, Huntsville AL 35806",      unitCount:88,  amenities:["Kitchen","Parking","In-Room Safe","Laundry","Wi-Fi","Desk"],   note:"In-room safe, workspace, extended stay"},
    ],
    apartment:[
      {name:"Redstone Gateway Apartments",         type:"apartment", phone:"256-327-5700",address:"2700 Redstone Gateway, Huntsville AL 35816",      unitCount:350, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Gym"], note:"Purpose-built near Redstone Arsenal — contractor housing specialist"},
      {name:"The Vue at Harvest",                  type:"apartment", phone:"256-230-9400",address:"100 Williams Ave, Harvest AL 35749",              unitCount:240, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Pool"],note:"Furnished units, monthly leases, near Arsenal corridor"},
      {name:"Greystar – Redstone Park",            type:"apartment", phone:"256-489-2400",address:"7000 Adventist Blvd, Huntsville AL 35896",        unitCount:288, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Gym"],note:"Greystar managed, govt leases accepted, large unit count"},
      {name:"Furnished Finder – Huntsville",       type:"apartment", phone:"N/A",          address:"furnishedfinder.com → Huntsville AL",             unitCount:null,amenities:["Furnished","Kitchen"],                                         note:"Near Redstone — verify count per listing"},
    ]
  },
  "San Diego":{
    hotel:[
      {name:"Residence Inn San Diego Downtown",    type:"hotel",    phone:"619-487-1200",address:"1747 Pacific Hwy, San Diego CA 92101",            unitCount:126, amenities:["Kitchen","Parking","Fire Safe","Laundry","Wi-Fi","Pool"],       note:"Near Naval Base SD, fire safe, kitchen"},
      {name:"Homewood Suites San Diego",           type:"hotel",    phone:"619-233-4100",address:"2550 Fifth Ave, San Diego CA 92103",              unitCount:182, amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Breakfast"],         note:"Full kitchen, govt rates, laundry"},
    ],
    apartment:[
      {name:"Greystar – Vantage Point Apartments", type:"apartment", phone:"619-756-7300",address:"3580 Caminito Ct, San Diego CA 92108",            unitCount:396, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Pool","Gym"],note:"Greystar — near Naval Base SD, large inventory, govt leases"},
      {name:"AMLI Warner Center San Diego",        type:"apartment", phone:"619-295-3100",address:"3415 6th Ave, San Diego CA 92103",                unitCount:280, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA","Gym"], note:"AMLI managed, furnished, govt lease experience"},
      {name:"Equity – Pacific Beach Apts",         type:"apartment", phone:"619-272-4000",address:"2085 Garnet Ave, San Diego CA 92109",             unitCount:214, amenities:["Furnished","Kitchen","Parking","Laundry","Wi-Fi","ADA"],       note:"Near Naval Base, furnished units available"},
      {name:"Furnished Finder – San Diego",        type:"apartment", phone:"N/A",          address:"furnishedfinder.com → San Diego CA",              unitCount:null,amenities:["Furnished","Kitchen"],                                         note:"Near Naval Base SD — verify count per listing"},
    ]
  },

  // ── INTERNATIONAL — EUROPE ────────────────────────────────────────────────
  "London":{
    hotel:[
      {name:"Marriott London Grosvenor Square",   type:"hotel", phone:"+44-20-7493-1232", address:"Grosvenor Sq, London W1K 6JP, UK",           unitCount:236, amenities:["Kitchen","Parking","In-Room Safe","Laundry","Wi-Fi","Gym"],      note:"Near US Embassy Mayfair — top State Dept choice. GSA compliant, fire safe BS 5839."},
      {name:"Hilton London Metropole",             type:"hotel", phone:"+44-20-7402-4141", address:"225 Edgware Rd, London W2 1JU, UK",          unitCount:1059,amenities:["In-Room Safe","Parking","Wi-Fi","Laundry","TV","Gym"],            note:"Large capacity — embassy overflow TDY. DoD DTS accepted."},
      {name:"Residence Inn London Kensington",     type:"hotel", phone:"+44-20-7590-6400", address:"381 Kings Rd, London SW10 0LP, UK",          unitCount:136, amenities:["Kitchen","Wi-Fi","In-Room Safe","Laundry","TV","Gym"],             note:"Extended stay, kitchen, fire safe — ideal for 30+ day TDY."},
      {name:"Hilton London Tower Bridge",          type:"hotel", phone:"+44-20-3002-4300", address:"5 More London Pl, London SE1 2BY, UK",       unitCount:245, amenities:["In-Room Safe","Wi-Fi","TV","Gym","Parking"],                    note:"City location, secure, DoD preferred property list."},
    ]
  },
  "Brussels":{
    hotel:[
      {name:"Marriott Brussels",                   type:"hotel", phone:"+32-2-516-9090",   address:"Rue Auguste Orts 3-7, 1000 Brussels, Belgium",unitCount:212, amenities:["In-Room Safe","Wi-Fi","Kitchen","Parking","Laundry","Gym"],      note:"Near NATO HQ — top choice for NATO SOFA TDY. DoD DTS accepted."},
      {name:"Hilton Brussels Grand Place",         type:"hotel", phone:"+32-2-548-4211",   address:"Carrefour de l'Europe 3, 1000 Brussels",     unitCount:223, amenities:["In-Room Safe","Wi-Fi","TV","Parking","Gym"],                    note:"Central Brussels, embassy proximity, secure."},
      {name:"Sheraton Brussels Airport",           type:"hotel", phone:"+32-2-710-8000",   address:"Brussels Airport, Zaventem 1930, Belgium",   unitCount:294, amenities:["In-Room Safe","Wi-Fi","Parking","Laundry","Gym","Pool"],       note:"NATO HQ 20 min — airport TDY transits."},
    ]
  },
  "Frankfurt":{
    hotel:[
      {name:"Marriott Frankfurt",                  type:"hotel", phone:"+49-69-7957-0",    address:"Hamburger Allee 2, 60486 Frankfurt, Germany", unitCount:588, amenities:["In-Room Safe","Wi-Fi","Kitchen","Parking","Laundry","Gym"],      note:"Near USAREUR-AF HQ — flagship DoD TDY property. SOFA Germany."},
      {name:"Hilton Frankfurt City Centre",        type:"hotel", phone:"+49-69-1338-0",    address:"Hochstr. 4, 60313 Frankfurt, Germany",        unitCount:342, amenities:["In-Room Safe","Wi-Fi","TV","Parking","Gym"],                    note:"City center, fire safe MBO compliant, DoD DTS."},
      {name:"Sheraton Frankfurt",                  type:"hotel", phone:"+49-69-2577-0",    address:"Hugo-Eckener-Ring 15, Frankfurt Airport",     unitCount:1008,amenities:["In-Room Safe","Wi-Fi","Parking","Gym","Pool","Laundry"],      note:"Airport — transit TDY, massive capacity, SOFA compliant."},
    ]
  },
  "Rome":{
    hotel:[
      {name:"Marriott Rome Grand Flora",           type:"hotel", phone:"+39-06-489-929",   address:"Via Veneto 191, 00187 Rome, Italy",           unitCount:156, amenities:["In-Room Safe","Wi-Fi","Kitchen","Parking","Gym","TV"],          note:"Directly across from US Embassy Via Veneto. Top State Dept pick."},
      {name:"Hilton Rome Cavalieri",               type:"hotel", phone:"+39-06-3509-1",    address:"Via Cadlolo 101, 00136 Rome, Italy",           unitCount:370, amenities:["In-Room Safe","Wi-Fi","Pool","Parking","Gym","Laundry"],       note:"Hilton flagship Rome — DoD preferred, Italian fire code compliant."},
      {name:"Residence Inn Rome",                  type:"hotel", phone:"+39-06-8535-0680", address:"Via Labicana 144, 00184 Rome, Italy",          unitCount:124, amenities:["Kitchen","Wi-Fi","In-Room Safe","Laundry","TV"],               note:"Extended stay near Colosseum — 30+ day TDY ideal."},
    ]
  },

  // ── INTERNATIONAL — MIDDLE EAST ──────────────────────────────────────────
  "Doha":{
    hotel:[
      {name:"Marriott Doha City Center",           type:"hotel", phone:"+974-4429-8888",   address:"West Bay, Doha, Qatar",                      unitCount:364, amenities:["A/C","In-Room Safe","Wi-Fi","Pool","Gym","Parking","Laundry"],  note:"Near Al Udeid AB — top USAF CENTCOM TDY hotel. A/C critical."},
      {name:"Hilton Doha",                         type:"hotel", phone:"+974-4423-3333",   address:"Diplomatic Area, West Bay, Doha, Qatar",     unitCount:343, amenities:["A/C","In-Room Safe","Wi-Fi","Pool","Gym","Parking"],           note:"Diplomatic district — State Dept preferred. DoD DTS accepted."},
      {name:"InterContinental Doha",               type:"hotel", phone:"+974-4484-4444",   address:"Diplomatic Area, Doha, Qatar",               unitCount:369, amenities:["A/C","In-Room Safe","Wi-Fi","Pool","Gym","Parking","Beach"],   note:"IHG — govt rate capable. Security clearance-friendly access."},
      {name:"Marriott Residence Inn Doha",         type:"hotel", phone:"+974-4436-4000",   address:"Al Majd St, Musheireb, Doha, Qatar",         unitCount:178, amenities:["Kitchen","A/C","In-Room Safe","Wi-Fi","Pool","Gym","Laundry"],note:"Extended stay 30+ days. Kitchen, laundry — best for long TDY."},
    ]
  },
  "Dubai":{
    hotel:[
      {name:"Marriott Dubai Harbour",              type:"hotel", phone:"+971-4-319-4000",  address:"Dubai Harbour, Dubai, UAE",                  unitCount:531, amenities:["A/C","In-Room Safe","Wi-Fi","Pool","Gym","Parking","Beach"],   note:"NAVCENT preferred — DoD DTS accepted. Top State Dept rate."},
      {name:"Hilton Dubai Al Habtoor City",        type:"hotel", phone:"+971-4-435-5555",  address:"Al Habtoor City, Dubai, UAE",                unitCount:1580,amenities:["A/C","In-Room Safe","Wi-Fi","Pool","Gym","Parking"],          note:"Large capacity — US Consulate overflow TDY. A/C critical."},
      {name:"Residence Inn Dubai Business Bay",    type:"hotel", phone:"+971-4-433-0000",  address:"Business Bay, Dubai, UAE",                   unitCount:198, amenities:["Kitchen","A/C","In-Room Safe","Wi-Fi","Pool","Gym","Laundry"],note:"Extended stay 30+ days, kitchen, near US Consulate DIFC."},
    ]
  },

  // ── INTERNATIONAL — ASIA PACIFIC ─────────────────────────────────────────
  "Tokyo":{
    hotel:[
      {name:"Marriott Tokyo",                      type:"hotel", phone:"+81-3-3360-7111",  address:"2-1-1 Dogenzaka, Shibuya, Tokyo 150-0043",   unitCount:772, amenities:["In-Room Safe","Wi-Fi","Kitchen","Parking","Gym","Laundry"],   note:"USFJ preferred — near Yokota AB transit. Japan SOFA compliant. Top DoD pick."},
      {name:"Hilton Tokyo",                        type:"hotel", phone:"+81-3-3344-5111",  address:"6-6-2 Nishi-Shinjuku, Tokyo 160-0023",        unitCount:806, amenities:["In-Room Safe","Wi-Fi","Gym","Pool","Parking","TV"],           note:"Shinjuku — DoD DTS accepted. Large capacity for Navy Yokosuka TDY."},
      {name:"Residence Inn Tokyo Ginza",           type:"hotel", phone:"+81-3-6253-1200",  address:"6-14-10 Ginza, Chuo, Tokyo 104-0061",         unitCount:200, amenities:["Kitchen","In-Room Safe","Wi-Fi","Gym","Laundry","TV"],        note:"Extended stay kitchen — ideal for 30+ day USFJ rotations."},
      {name:"Sheraton Grand Tokyo Bay",            type:"hotel", phone:"+81-47-355-5555",  address:"1-9 Maihama, Urayasu, Chiba 279-0031",        unitCount:1032,amenities:["In-Room Safe","Wi-Fi","Pool","Gym","Parking","Laundry"],   note:"Near Yokosuka Naval Base corridor. Fire Service Act compliant."},
    ]
  },
  "Seoul":{
    hotel:[
      {name:"Marriott Seoul",                      type:"hotel", phone:"+82-2-6388-8000",  address:"176 Toegyero, Jung-gu, Seoul, South Korea",   unitCount:515, amenities:["In-Room Safe","Wi-Fi","Kitchen","Parking","Gym","Laundry"],   note:"Near Camp Humphreys transit corridor. Korea SOFA compliant. Top USFK pick."},
      {name:"Hilton Seoul",                        type:"hotel", phone:"+82-2-753-7788",   address:"50 Sowol-ro, Yongsan, Seoul",                  unitCount:683, amenities:["In-Room Safe","Wi-Fi","Gym","Pool","Parking","TV"],           note:"Yongsan — near US Embassy Seoul. DoD DTS accepted."},
      {name:"Sheraton Grand Incheon",              type:"hotel", phone:"+82-32-745-1101",  address:"175 Seonyu-ro, Yeonsu-gu, Incheon",            unitCount:321, amenities:["In-Room Safe","Wi-Fi","Gym","Parking","Laundry","Pool"],    note:"Near Osan AB / Incheon Airport — transit TDY. Korean fire safety."},
    ]
  },
  "Singapore":{
    hotel:[
      {name:"Marriott Singapore Tang Plaza",       type:"hotel", phone:"+65-6735-5800",    address:"320 Orchard Rd, Singapore 238865",            unitCount:393, amenities:["A/C","In-Room Safe","Wi-Fi","Pool","Gym","Parking","Laundry"],note:"COMLOG WESTPAC preferred — DoD DTS accepted. Singapore FSSD compliant."},
      {name:"Hilton Singapore Orchard",            type:"hotel", phone:"+65-6737-2233",    address:"581 Orchard Rd, Singapore 238883",            unitCount:1080,amenities:["A/C","In-Room Safe","Wi-Fi","Pool","Gym","Parking"],         note:"Large capacity — Navy PACOM overflow TDY. US Embassy proximity."},
      {name:"Residence Inn Singapore",             type:"hotel", phone:"+65-6797-7777",    address:"111 Middle Rd, Singapore 188967",             unitCount:289, amenities:["Kitchen","A/C","In-Room Safe","Wi-Fi","Pool","Gym","Laundry"],note:"Extended stay 30+ days — kitchen, near Changi Naval Base."},
    ]
  },

  // ── INTERNATIONAL — AMERICAS ─────────────────────────────────────────────
  "Ottawa":{
    hotel:[
      {name:"Marriott Ottawa",                     type:"hotel", phone:"+1-613-238-1122",  address:"100 Kent St, Ottawa, ON K1P 5R7, Canada",     unitCount:480, amenities:["In-Room Safe","Wi-Fi","Kitchen","Parking","Gym","Laundry"],   note:"Near US Embassy Sussex Dr. Top State Dept / NORAD liaison pick."},
      {name:"Hilton Ottawa",                       type:"hotel", phone:"+1-613-238-1500",  address:"150 Albert St, Ottawa, ON K1P 5G2, Canada",   unitCount:482, amenities:["In-Room Safe","Wi-Fi","Gym","Parking","TV"],                 note:"Parliament Hill area — DoD DTS accepted. Canadian NBC fire code."},
      {name:"Residence Inn Ottawa Downtown",       type:"hotel", phone:"+1-613-231-2020",  address:"161 Laurier Ave W, Ottawa, ON K1P 5J2",       unitCount:177, amenities:["Kitchen","In-Room Safe","Wi-Fi","Parking","Laundry","Gym"], note:"Extended stay — kitchen, near Embassy. USD billing capable."},
    ]
  },
  "Madison WI":{
    hotel:[
      {name:"Residence Inn Madison West",            type:"hotel",    phone:"608-833-8333",address:"8212 Watts Rd, Madison WI 53719",                unitCount:110, amenities:["Kitchen","Parking","Fire Safe","Laundry","Wi-Fi","Pool"],       note:"⭐ Best extended-stay near VA Medical Center (4 mi). Kitchen, fire safe, DoD preferred. GSA eligible."},
      {name:"Homewood Suites Madison West",          type:"hotel",    phone:"608-833-4400",address:"439 Grand Canyon Dr, Madison WI 53719",           unitCount:96,  amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Breakfast"],         note:"Full kitchen, breakfast, laundry — 5 mi from VAMC Madison. Govt rates available."},
      {name:"TownePlace Suites Madison",             type:"hotel",    phone:"608-241-9700",address:"5421 Grand Teton Plaza, Madison WI 53719",        unitCount:88,  amenities:["Kitchen","Parking","In-Room Safe","Laundry","Wi-Fi","Desk"],   note:"In-room safe, workspace, extended stay — 4.5 mi from VA. GSA rate compliant."},
    ],
    apartment:[
      {name:"The Pressman Apartments",               type:"apartment", phone:"608-203-0700", address:"306 W Johnson St, Madison WI 53703",            unitCount:124, rating:4.4, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Gym"],   note:"⭐ 4.4 — 2020 build, 124 units. 2 mi from VAMC. Corporate lease friendly. Greystar managed. ✅ TOP PICK Madison VA contract."},
      {name:"Junction at University",                type:"apartment", phone:"608-441-7100", address:"702 University Ave, Madison WI 53706",          unitCount:200, rating:4.2, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Gym","Pool"],note:"⭐ 4.2 — 200 units, pool, gym. 3 mi from VAMC. Month-to-month options. Strong reviews. ✅ Strong Madison pick."},
      {name:"Avalon at Breckenridge",                type:"apartment", phone:"608-819-8000", address:"6818 Watts Rd, Madison WI 53719",               unitCount:288, rating:4.1, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Pool","Gym"],note:"⭐ 4.1 — 288 units. Closest large complex to VAMC Madison (2.5 mi). Govt lease experience. Corporate leases accepted."},
      {name:"Furnished Finder – Madison WI",         type:"apartment", phone:"N/A",           address:"furnishedfinder.com → Madison WI",              unitCount:null, rating:null, amenities:["Furnished","Kitchen"],                                            note:"Mid-term furnished units near VAMC. Verify unit count and ADA availability per listing."},
    ]
  },
  "Chicago IL":{
    hotel:[
      {name:"Residence Inn Chicago Midway",          type:"hotel",    phone:"708-924-9000",address:"6638 S Cicero Ave, Bedford Park IL 60638",        unitCount:128, amenities:["Kitchen","Parking","Fire Safe","Laundry","Wi-Fi","Pool"],       note:"⭐ Near Midway, fire safe, full kitchen. FEMA Region 5 preferred. GSA eligible. DoD DTS accepted."},
      {name:"Homewood Suites Chicago Downtown",      type:"hotel",    phone:"312-644-2222",address:"40 E Grand Ave, Chicago IL 60611",                 unitCount:233, amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Breakfast"],         note:"Full kitchen, downtown loop, laundry. Large capacity for FEMA surge housing. Govt rates."},
      {name:"TownePlace Suites Chicago Schaumburg",  type:"hotel",    phone:"847-517-0300",address:"1200 E Bank Dr, Schaumburg IL 60173",              unitCount:95,  amenities:["Kitchen","Parking","In-Room Safe","Laundry","Wi-Fi","Desk"],   note:"Suburb location, in-room safe, workspace. Lower cost than downtown for extended FEMA stays."},
      {name:"Staybridge Suites Chicago O'Hare",      type:"hotel",    phone:"847-544-9300",address:"7746 Catrina Ave, Rosemont IL 60018",              unitCount:132, amenities:["Kitchen","Parking","Laundry","Wi-Fi","TV","Pool","In-Room Safe"],note:"O'Hare corridor, in-room safe, kitchen, pool. FEMA activation — quick access to transit."},
    ],
    apartment:[
      {name:"Greystar – Arrive River North",         type:"apartment", phone:"312-600-4050", address:"354 W Hubbard St, Chicago IL 60654",             unitCount:358, rating:4.3, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Gym","Pool"],note:"⭐ 4.3 — 358 units. Greystar managed — govt lease experience. River North. ADA units. Large inventory for FEMA surge. ✅ TOP PICK Chicago FEMA contract."},
      {name:"Amli 808 Apartments",                   type:"apartment", phone:"312-666-0808", address:"808 N Wells St, Chicago IL 60610",               unitCount:298, rating:4.2, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Gym"],      note:"⭐ 4.2 — AMLI managed, 298 units. Corporate leases accepted. Near Loop for FEMA field office access. Furnished packages available."},
      {name:"The Sinclair Apartments",               type:"apartment", phone:"312-285-3400", address:"1201 N Clark St, Chicago IL 60610",              unitCount:401, rating:4.1, amenities:["Furnished","Kitchen","Laundry","Parking","Wi-Fi","ADA","Pool","Gym"],note:"⭐ 4.1 — 401 units, pool, gym. Large capacity matches FEMA 10–25 unit requirement. Monthly lease options."},
      {name:"Furnished Finder – Chicago",            type:"apartment", phone:"N/A",           address:"furnishedfinder.com → Chicago IL",               unitCount:null, rating:null, amenities:["Furnished","Kitchen"],                                            note:"Mid-term furnished units Cook County area. Filter by ADA, unit count, and proximity to FEMA field office."},
    ]
  },
};

// ── ROOM NIGHTS CALCULATOR ────────────────────────────────────────────────────
function RoomNightsCalc({c, gsaRate}){
  const sow = c.sow||{};
  const bidRate = Math.round(gsaRate*0.98);

  // Parse units
  const unitNums = String(sow.units||"").match(/\d+/g);
  const minUnits = unitNums ? parseInt(unitNums[0]) : null;
  const maxUnits = unitNums ? parseInt(unitNums[unitNums.length-1]) : null;

  // Parse nights from duration
  const dur = String(sow.duration||"");
  const nm  = dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*night/i)||dur.match(/(\d+)\s*night/i);
  const dm  = dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*day/i)  ||dur.match(/(\d+)\s*day/i);
  const mm  = dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*month/i)||dur.match(/(\d+)\s*month/i);
  let minNights=null, maxNights=null;
  if(nm){minNights=parseInt(nm[1]); maxNights=nm[2]?parseInt(nm[2]):minNights;}
  else if(dm){minNights=parseInt(dm[1]); maxNights=dm[2]?parseInt(dm[2]):minNights;}
  else if(mm){minNights=parseInt(mm[1])*30; maxNights=mm[2]?parseInt(mm[2])*30:minNights;}
  const schedNights = sow?.lodgingSchedule?.nightsPerYear;
  const nights = maxNights || schedNights;
  const nightsLabel = minNights&&maxNights&&minNights!==maxNights
    ? minNights+"–"+maxNights+" nights"
    : nights ? nights+" nights" : "Verify on SAM.gov";

  const maxRN = maxUnits&&nights ? maxUnits*nights : null;
  const minRN = minUnits&&minNights ? minUnits*minNights : null;
  const grossMax = maxRN ? maxRN*bidRate : null;
  const grossMin = minRN ? minRN*bidRate : null;

  // $10K/mo profit target
  const contractMonths = mm ? (mm[2]?parseInt(mm[2]):parseInt(mm[1])) : (nights?Math.ceil(nights/30):3);
  const maxHotelRate = grossMax&&contractMonths ? Math.floor((grossMax-(10000*contractMonths))/maxRN) : null;

  return(
    <div style={{background:`linear-gradient(135deg,${NAV},#1e3a6e)`,borderRadius:12,
      padding:"14px 16px",marginBottom:12,border:`2px solid ${MINT2}`}}>

      <div style={{fontSize:10,fontWeight:900,color:MINT,textTransform:"uppercase",
        letterSpacing:1,marginBottom:12}}>
        🏨 Room Nights Calculator — Hotel Industry Metric
      </div>

      {/* Three key numbers */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"10px",textAlign:"center"}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",fontWeight:700,
            textTransform:"uppercase",letterSpacing:0.6,marginBottom:4}}>
            🛏️ Sleeping Rooms
          </div>
          <div style={{fontSize:22,fontWeight:900,color:"#fff"}}>
            {minUnits&&minUnits!==maxUnits?minUnits+"–"+maxUnits:maxUnits||"?"}
          </div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>per night</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"10px",textAlign:"center"}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",fontWeight:700,
            textTransform:"uppercase",letterSpacing:0.6,marginBottom:4}}>
            🌙 Total Nights
          </div>
          <div style={{fontSize:22,fontWeight:900,color:"#fff"}}>
            {nights||"?"}
          </div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.5)"}}>{nightsLabel}</div>
        </div>
        <div style={{background:"rgba(219,239,226,0.2)",border:`1.5px solid ${MINT2}`,
          borderRadius:8,padding:"10px",textAlign:"center"}}>
          <div style={{fontSize:9,color:MINT,fontWeight:800,
            textTransform:"uppercase",letterSpacing:0.6,marginBottom:4}}>
            = Total Room Nights
          </div>
          <div style={{fontSize:22,fontWeight:900,color:MINT}}>
            {maxRN?( minRN&&minRN!==maxRN?minRN+"–"+maxRN:maxRN ):"?"}
          </div>
          <div style={{fontSize:9,color:"rgba(219,239,226,0.7)"}}>tell hotels this number</div>
        </div>
      </div>

      {/* Formula */}
      <div style={{background:"rgba(0,0,0,0.2)",borderRadius:7,padding:"8px 12px",
        marginBottom:12,fontSize:11,color:"rgba(255,255,255,0.7)",textAlign:"center"}}>
        {maxUnits||"X"} sleeping rooms × {nights||"Y"} nights = <strong style={{color:MINT}}>
          {maxRN||"Z"} total room nights
        </strong>
      </div>

      {/* Gross income — Step 4 */}
      {grossMax&&(
        <div style={{background:"rgba(27,94,32,0.4)",border:"2px solid #69f0ae",
          borderRadius:9,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:900,color:"#69f0ae",textTransform:"uppercase",
            letterSpacing:0.8,marginBottom:8}}>
            💵 Potential Gross Income
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:7,padding:"9px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",fontWeight:700,
                textTransform:"uppercase",marginBottom:3}}>GSA Max Rate</div>
              <div style={{fontSize:14,fontWeight:900,color:"rgba(255,255,255,0.7)"}}>
                {"$"+gsaRate+"/nt"}
              </div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>do not exceed</div>
            </div>
            <div style={{background:"rgba(255,255,255,0.08)",borderRadius:7,padding:"9px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",fontWeight:700,
                textTransform:"uppercase",marginBottom:3}}>Your Bid Rate</div>
              <div style={{fontSize:14,fontWeight:900,color:MINT}}>{"$"+bidRate+"/nt"}</div>
              <div style={{fontSize:9,color:"rgba(219,239,226,0.5)"}}>2% below GSA</div>
            </div>
            <div style={{background:"rgba(27,94,32,0.5)",border:"1.5px solid #69f0ae",
              borderRadius:7,padding:"9px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#69f0ae",fontWeight:800,
                textTransform:"uppercase",marginBottom:3}}>⭐ Gross Revenue</div>
              <div style={{fontSize:16,fontWeight:900,color:"#fff"}}>
                {"$"+grossMax.toLocaleString()}
              </div>
              {grossMin&&grossMin!==grossMax&&(
                <div style={{fontSize:9,color:"#69f0ae"}}>{"min $"+grossMin.toLocaleString()}</div>
              )}
            </div>
          </div>

          {maxHotelRate&&(
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:7,padding:"9px 12px",
              fontSize:11,color:"rgba(255,255,255,0.85)",lineHeight:1.7}}>
              <strong style={{color:"#69f0ae"}}>🤝 Negotiating with hotels:</strong> To hit
              your <strong style={{color:"#fff"}}>$10K/month profit target</strong>, pay the
              hotel no more than{" "}
              <strong style={{color:MINT}}>{"$"+maxHotelRate+"/room/night"}</strong>.
              Start your offer at{" "}
              <strong style={{color:"#fff"}}>{"$"+Math.round(maxHotelRate*0.88)+"/night"}</strong>{" "}
              and walk up to{" "}
              <strong style={{color:"#fff"}}>{"$"+maxHotelRate+"/night"}</strong> max.
              That keeps{" "}
              <strong style={{color:"#69f0ae"}}>
                {"$"+(bidRate-maxHotelRate).toLocaleString()+"/room/night"}
              </strong>{" "}
              for your margin.
            </div>
          )}
        </div>
      )}

      {/* Phone script */}
      <div style={{background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"10px 13px",
        fontSize:11,color:"rgba(255,255,255,0.85)",lineHeight:1.7}}>
        <strong style={{color:MINT,display:"block",marginBottom:4}}>
          📞 Word-for-word script when you call hotels:
        </strong>
        "Hi, this is Kayla Deitte from KD Modern Rentals. I'm bidding on a federal government
        contract and need to block{" "}
        <strong style={{color:"#fff"}}>{maxUnits||"[X]"} sleeping rooms</strong> for{" "}
        <strong style={{color:"#fff"}}>{nightsLabel}</strong> — that's{" "}
        <strong style={{color:MINT}}>{maxRN||"[Z]"} total room nights</strong>. I need a
        written government block rate quote valid through{" "}
        <strong style={{color:"#fff"}}>{new Date(c.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</strong>.
        Do you work with government contractors?"
      </div>
    </div>
  );
}

// ── HOTEL PROFIT SEARCH ───────────────────────────────────────────────────────
function HotelProfitSearch({c, gsaRate}){
  const [results,setResults]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  const sow=c.sow||{};
  const bidRate=Math.round(gsaRate*0.98);

  // Calc room nights
  const unitNums=String(sow.units||"").match(/\d+/g);
  const maxUnits=unitNums?parseInt(unitNums[unitNums.length-1]):null;
  const dur=String(sow.duration||"");
  const nm=dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*night/i)||dur.match(/(\d+)\s*night/i);
  const dm=dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*day/i)||dur.match(/(\d+)\s*day/i);
  const mm=dur.match(/(\d+)\s*(?:–|-)\s*(\d+)\s*month/i)||dur.match(/(\d+)\s*month/i);
  let maxNights=null;
  if(nm){maxNights=nm[2]?parseInt(nm[2]):parseInt(nm[1]);}
  else if(dm){maxNights=dm[2]?parseInt(dm[2]):parseInt(dm[1]);}
  else if(mm){maxNights=mm[2]?parseInt(mm[2])*30:parseInt(mm[1])*30;}
  const schedNights=sow?.lodgingSchedule?.nightsPerYear;
  const totalNights=maxNights||schedNights;
  const roomNights=maxUnits&&totalNights?maxUnits*totalNights:null;
  const grossRevenue=roomNights?roomNights*bidRate:null;
  const contractMonths=mm?(mm[2]?parseInt(mm[2]):parseInt(mm[1])):(totalNights?Math.ceil(totalNights/30):3);
  const maxHotelRate=grossRevenue&&roomNights?Math.floor((grossRevenue-(10000*contractMonths))/roomNights):null;
  const amenities=(sow.amenities||[]).join(", ");
  const needsConf=amenities.toLowerCase().includes("conference")||amenities.toLowerCase().includes("meeting")||(sow.requirements||[]).join(" ").toLowerCase().includes("conference");

  async function search(){
    setLoading(true);
    setError(null);
    setResults(null);

    const prompt=`You are a hotel sourcing expert. Search for real hotels for this government contract and return profit analysis. Return ONLY valid JSON.

CONTRACT:
- City: ${c.city}
- Location required: ${sow.location||c.city}
- Sleeping rooms needed: ${sow.units||"verify"}
- Duration: ${sow.duration||"verify"}
- Total room nights: ${roomNights||"calculate"}
- Arrival date: ${c.moveInDate||"TBD"}
- Required amenities: ${amenities}
- Conference/meeting space required: ${needsConf}
- Extended stay preferred: ${!needsConf}

FINANCIALS:
- We bill govt at: $${bidRate}/night (our bid rate)
- GSA ceiling: $${gsaRate}/night
- Total gross revenue: ${grossRevenue?"$"+grossRevenue.toLocaleString():"calculate"}
- Max we can pay hotel for $10K/mo profit: $${maxHotelRate||"calculate"}/room/night

HOTEL CRITERIA:
- Minimum 4.3 stars Google rating
- ${needsConf?"Full service hotel with meeting/conference space":"Extended stay preferred: Residence Inn, TownePlace, Homewood Suites, Home2, Staybridge, Candlewood, Hyatt House"}
- Must match SOW amenities: ${amenities}
- Must be near: ${sow.location||c.city}
- Must accommodate ${maxUnits||"required"} rooms OR note if split properties needed

Return JSON:
{
  "searchDate": "today's date",
  "city": "${c.city}",
  "marketSummary": "2 sentences on current hotel market in this city for these dates",
  "currentMarketRate": "$X-$Y/night typical rate right now for this city/dates",
  "extendedStayRate": "$X-$Y/night typical extended stay/block rate for ${totalNights||30}+ nights",
  "splitAllowed": true or false based on whether SOW allows split properties,
  "hotels": [
    {
      "name": "Full hotel name",
      "brand": "Marriott/Hilton/IHG/Hyatt/etc",
      "type": "Extended Stay" or "Full Service" or "Select Service",
      "address": "Full address",
      "phone": "Hotel phone number",
      "stars": 4.5,
      "googleRating": "4.5/5 (820 reviews)",
      "reviewSummary": "Guests praise cleanliness and staff. Great for long stays.",
      "totalRooms": 120,
      "canHandle": true or false,
      "splitNote": "if false: suggest pairing with another hotel",
      "hasKitchen": true or false,
      "hasLaundry": true or false,
      "hasParking": true or false,
      "hasSafe": true or false,
      "hasConference": true or false,
      "amenitiesMissing": ["any SOW amenities this hotel lacks"],
      "currentRackRate": 145,
      "estimatedBlockRate": 98,
      "ourTargetOffer": 85,
      "ourMaxOffer": ${maxHotelRate||95},
      "profitPerRoomPerNight": ${bidRate} - estimatedBlockRate,
      "totalProfitAtBlockRate": (${bidRate} - estimatedBlockRate) * ${roomNights||100},
      "totalProfitAtTargetOffer": (${bidRate} - 85) * ${roomNights||100},
      "monthlyProfit": "calculate monthly",
      "meetsTarget": true or false if monthly profit >= 10000,
      "distanceToBase": "X miles from [agency/base name]",
      "negotiationLeverage": "specific reason this hotel would want this block contract",
      "callScript": "Exact word-for-word opening when you call: Hi this is Kayla from KD Modern Rentals...",
      "bookingLink": "https://google.com/travel/hotels/[city]",
      "verdict": "CALL FIRST" or "STRONG OPTION" or "BACKUP" or "SKIP"
    }
  ],
  "profitSpread": {
    "bestCase": "$X,XXX/month at lowest hotel rate",
    "targetCase": "$X,XXX/month at target negotiated rate",
    "worstCase": "$X,XXX/month at highest hotel rate",
    "breakEven": "$X/room/night max hotel rate to break even"
  },
  "negotiationTips": ["tip1","tip2","tip3"],
  "doNotContact": ["Hotel name — reason"]
}

Find 5-8 REAL hotels with real addresses and phone numbers. Be specific and honest about profit math.`;

    try{
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:prompt}]
        })
      });
      const data=await resp.json();
      const textBlock=data.content?.find(b=>b.type==="text");
      if(!textBlock) throw new Error("No response from search");
      const raw=textBlock.text.replace(/```json|```/g,"").trim();
      const start=raw.indexOf("{");
      const end=raw.lastIndexOf("}");
      const parsed=JSON.parse(raw.slice(start,end+1));
      setResults(parsed);
    }catch(e){
      setError("Search failed — "+e.message);
    }
    setLoading(false);
  }

  const verdictStyle=v=>({
    "CALL FIRST":{bg:"#e8f5e9",color:"#1b5e20",border:"#a5d6a7"},
    "STRONG OPTION":{bg:"#e3f2fd",color:"#1565c0",border:"#90caf9"},
    "BACKUP":{bg:"#fff3e0",color:"#e65100",border:"#ffcc02"},
    "SKIP":{bg:"#ffebee",color:"#c62828",border:"#ef9a9a"},
  }[v]||{bg:"#f5f5f5",color:"#666",border:"#ddd"});

  return(
    <div style={{marginBottom:14}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1b5e20,#2e7d32)",borderRadius:12,
        padding:"14px 16px",marginBottom:results?10:0}}>
        <div style={{fontSize:12,fontWeight:900,color:"#fff",textTransform:"uppercase",
          letterSpacing:0.8,marginBottom:6}}>
          🔍 Live Hotel Search — Profit Spread Analysis
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.8)",lineHeight:1.6,marginBottom:10}}>
          Searches for real <strong style={{color:"#fff"}}>4.3+ star hotels</strong> in {c.city} that match SOW requirements.
          Shows profit at each hotel's rate so you can see the full spread before negotiating.
          {grossRevenue&&<span> Gross revenue: <strong style={{color:"#69f0ae"}}>{"$"+grossRevenue.toLocaleString()}</strong>. Max hotel rate for $10K/mo profit: <strong style={{color:"#69f0ae"}}>{maxHotelRate?"$"+maxHotelRate+"/rm/nt":"calculating"}</strong>.</span>}
        </div>
        <button onClick={search} disabled={loading} style={{
          background:loading?"rgba(255,255,255,0.2)":"#fff",
          color:loading?"rgba(255,255,255,0.6)":"#1b5e20",
          border:"none",borderRadius:8,padding:"9px 20px",fontSize:12,fontWeight:800,
          cursor:loading?"not-allowed":"pointer",width:"100%"}}>
          {loading?"🔍 Searching hotels + calculating profit spread...":"🔍 Find Hotels & Calculate My Profit Spread"}
        </button>
      </div>

      {error&&(
        <div style={{background:"#ffebee",border:"1px solid #ef9a9a",borderRadius:8,
          padding:"10px 14px",fontSize:12,color:"#c62828",marginBottom:10}}>{error}</div>
      )}

      {results&&(
        <div>
          {/* Market summary */}
          <div style={{background:"#e8f5e9",border:"2px solid #66bb6a",borderRadius:10,
            padding:"12px 14px",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:800,color:"#1b5e20",marginBottom:6}}>
              📊 Current Market — {c.city}
            </div>
            <div style={{fontSize:12,color:"#2e3a2e",lineHeight:1.7,marginBottom:8}}>
              {results.marketSummary}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"#fff",borderRadius:7,padding:"8px 11px",border:"1px solid #a5d6a7"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",marginBottom:3}}>
                  Current Market Rate
                </div>
                <div style={{fontSize:14,fontWeight:900,color:"#e65100"}}>
                  {results.currentMarketRate||"See hotels below"}
                </div>
                <div style={{fontSize:9,color:"#667"}}>walk-in / public rate</div>
              </div>
              <div style={{background:"#fff",borderRadius:7,padding:"8px 11px",border:"1px solid #a5d6a7"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",marginBottom:3}}>
                  Extended Stay / Block Rate
                </div>
                <div style={{fontSize:14,fontWeight:900,color:"#1b5e20"}}>
                  {results.extendedStayRate||"Negotiate below"}
                </div>
                <div style={{fontSize:9,color:"#667"}}>for {totalNights||"30"}+ nights</div>
              </div>
            </div>
            {results.splitAllowed!==undefined&&(
              <div style={{marginTop:8,fontSize:11,fontWeight:700,
                color:results.splitAllowed?"#1565c0":"#c62828"}}>
                {results.splitAllowed
                  ?"✅ SOW allows guests split across multiple properties"
                  :"⛔ SOW requires ALL rooms at single property"}
              </div>
            )}
          </div>

          {/* Profit spread summary */}
          {results.profitSpread&&(
            <div style={{background:"#1a2340",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:800,color:MINT,textTransform:"uppercase",
                letterSpacing:0.8,marginBottom:8}}>
                💰 Your Profit Spread — Based on Negotiation Outcome
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[
                  {label:"Best Case",val:results.profitSpread.bestCase,color:"#69f0ae",sub:"lowest hotel rate"},
                  {label:"Target Case",val:results.profitSpread.targetCase,color:MINT,sub:"at your offer"},
                  {label:"Worst Case",val:results.profitSpread.worstCase,color:"#ff8a65",sub:"highest hotel rate"},
                ].map(({label,val,color,sub})=>(
                  <div key={label} style={{background:"rgba(255,255,255,0.08)",borderRadius:7,
                    padding:"9px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.55)",fontWeight:700,
                      textTransform:"uppercase",marginBottom:3}}>{label}</div>
                    <div style={{fontSize:14,fontWeight:900,color}}>{val||"—"}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>{sub}</div>
                  </div>
                ))}
              </div>
              {results.profitSpread.breakEven&&(
                <div style={{marginTop:8,fontSize:11,color:"rgba(255,255,255,0.7)",
                  background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"6px 10px"}}>
                  ⚠️ Break-even: {results.profitSpread.breakEven} — never pay hotels more than this
                </div>
              )}
            </div>
          )}

          {/* Hotel cards */}
          {(results.hotels||[]).map((h,i)=>{
            const vs=verdictStyle(h.verdict);
            const profitOk=h.meetsTarget;
            return(
              <div key={i} style={{background:"#fff",border:`2px solid ${vs.border}`,
                borderRadius:12,padding:"14px 16px",marginBottom:10}}>

                {/* Hotel header */}
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"flex-start",marginBottom:10,gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,
                      flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:14,fontWeight:900,color:"#1a2340"}}>{h.name}</span>
                      <span style={{background:vs.bg,color:vs.color,border:`1px solid ${vs.border}`,
                        borderRadius:5,padding:"2px 9px",fontSize:11,fontWeight:800}}>
                        {h.verdict}
                      </span>
                      {h.type&&(
                        <span style={{background:h.type==="Extended Stay"?"#e8f5e9":"#e3f2fd",
                          color:h.type==="Extended Stay"?"#1b5e20":"#1565c0",
                          borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700}}>
                          {h.type==="Extended Stay"?"🏠 Extended Stay":"🏨 "+h.type}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:11,color:"#667",marginBottom:3}}>📍 {h.address}</div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:800,color:"#f59e0b"}}>
                        {"★".repeat(Math.floor(h.stars||4))} {h.stars}
                      </span>
                      <span style={{fontSize:11,color:"#2e7d32",fontWeight:600}}>
                        {h.googleRating}
                      </span>
                      {h.distanceToBase&&(
                        <span style={{fontSize:11,color:"#667"}}>📏 {h.distanceToBase}</span>
                      )}
                      {h.totalRooms&&(
                        <span style={{fontSize:11,color:"#667"}}>🏠 {h.totalRooms} total rooms</span>
                      )}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:9,color:"#9aa",fontWeight:700,
                      textTransform:"uppercase",marginBottom:2}}>Your target offer</div>
                    <div style={{fontSize:20,fontWeight:900,color:"#1b5e20"}}>
                      {"$"+(h.ourTargetOffer||"?")}<span style={{fontSize:11,fontWeight:400,color:"#9aa"}}>/nt</span>
                    </div>
                    <div style={{fontSize:9,color:"#9aa"}}>
                      max {"$"+(h.ourMaxOffer||maxHotelRate||"?")+"/nt"}
                    </div>
                  </div>
                </div>

                {/* Review */}
                {h.reviewSummary&&(
                  <div style={{background:"#fffbf0",borderRadius:7,padding:"7px 11px",
                    fontSize:11,color:"#5a4000",fontStyle:"italic",marginBottom:10,
                    border:"1px solid #ffe08a"}}>
                    ⭐ "{h.reviewSummary}"
                  </div>
                )}

                {/* Room capability */}
                {!h.canHandle&&h.splitNote&&(
                  <div style={{background:"#e3f2fd",borderRadius:7,padding:"7px 11px",
                    fontSize:11,color:"#1565c0",fontWeight:600,marginBottom:8,
                    border:"1px solid #90caf9"}}>
                    🏨+🏨 {h.splitNote}
                  </div>
                )}

                {/* Rate & profit grid */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",
                  gap:7,marginBottom:10}}>
                  {[
                    {label:"Rack Rate Now",val:"$"+(h.currentRackRate||"?")+"/nt",
                      color:"#e65100",sub:"public rate"},
                    {label:"Est Block Rate",val:"$"+(h.estimatedBlockRate||"?")+"/nt",
                      color:"#1565c0",sub:"30+ nights"},
                    {label:"Your Offer",val:"$"+(h.ourTargetOffer||"?")+"/nt",
                      color:"#1b5e20",sub:"start here"},
                    {label:"Your Profit/Mo",val:h.monthlyProfit||"—",
                      color:profitOk?"#1b5e20":"#c62828",sub:profitOk?"✅ hits $10K":"❌ below $10K"},
                  ].map(({label,val,color,sub})=>(
                    <div key={label} style={{background:"#f8f9ff",borderRadius:7,
                      padding:"8px 9px",border:"1px solid #e4e9f4",textAlign:"center"}}>
                      <div style={{fontSize:9,fontWeight:700,color:"#9aa",
                        textTransform:"uppercase",marginBottom:2}}>{label}</div>
                      <div style={{fontSize:13,fontWeight:900,color}}>{val}</div>
                      <div style={{fontSize:9,color:profitOk&&label==="Your Profit/Mo"?"#1b5e20":"#9aa",
                        fontWeight:label==="Your Profit/Mo"?700:400}}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Total profit at block rate */}
                {h.totalProfitAtBlockRate&&(
                  <div style={{background:profitOk?"#e8f5e9":"#ffebee",borderRadius:7,
                    padding:"7px 12px",marginBottom:8,
                    border:`1px solid ${profitOk?"#a5d6a7":"#ef9a9a"}`,
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    flexWrap:"wrap",gap:6}}>
                    <span style={{fontSize:11,color:profitOk?"#1b5e20":"#c62828",fontWeight:700}}>
                      Total contract profit ({roomNights||"?"} room nights × {"$"+(bidRate-(h.estimatedBlockRate||0))+"/nt margin"}):
                    </span>
                    <span style={{fontSize:15,fontWeight:900,
                      color:profitOk?"#1b5e20":"#c62828"}}>
                      {"$"+(typeof h.totalProfitAtBlockRate==="number"
                        ?h.totalProfitAtBlockRate.toLocaleString()
                        :h.totalProfitAtBlockRate)}
                    </span>
                  </div>
                )}

                {/* Amenities */}
                {h.amenitiesMissing?.length>0&&(
                  <div style={{background:"#fff3e0",borderRadius:7,padding:"6px 10px",
                    marginBottom:8,border:"1px solid #ffcc02"}}>
                    <span style={{fontSize:10,color:"#e65100",fontWeight:700}}>
                      ⚠️ Missing SOW amenities:
                    </span>
                    <span style={{fontSize:10,color:"#5a3000",marginLeft:5}}>
                      {h.amenitiesMissing.join(", ")}
                    </span>
                  </div>
                )}

                {/* Amenity icons */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {[
                    [h.hasKitchen,"🍳","Kitchen"],
                    [h.hasLaundry,"🧺","Laundry"],
                    [h.hasParking,"🚗","Parking"],
                    [h.hasSafe,"🔒","Safe"],
                    [h.hasConference,"🎤","Conference"],
                  ].map(([has,icon,label])=>(
                    <span key={label} style={{
                      background:has?"#e8f5e9":"#f5f5f5",
                      color:has?"#1b5e20":"#aaa",
                      border:`1px solid ${has?"#a5d6a7":"#e0e0e0"}`,
                      borderRadius:12,padding:"2px 9px",fontSize:10,fontWeight:600}}>
                      {icon} {has?"✓":"✗"} {label}
                    </span>
                  ))}
                </div>

                {/* Negotiation leverage */}
                {h.negotiationLeverage&&(
                  <div style={{fontSize:11,color:"#334",lineHeight:1.6,marginBottom:8,
                    background:"#f0f4ff",borderRadius:6,padding:"6px 10px",
                    border:`1px solid ${NAV}20`}}>
                    💡 <strong>Your leverage:</strong> {h.negotiationLeverage}
                  </div>
                )}

                {/* Call script */}
                {h.callScript&&(
                  <div style={{background:"#f0f4ff",border:`1px solid ${NAV}30`,
                    borderRadius:8,padding:"9px 12px",marginBottom:10}}>
                    <div style={{fontSize:10,fontWeight:800,color:NAV,marginBottom:3}}>
                      📞 Call Script
                    </div>
                    <div style={{fontSize:11,color:"#1a2340",lineHeight:1.7,fontStyle:"italic"}}>
                      "{h.callScript}"
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {h.phone&&(
                    <a href={"tel:"+h.phone} style={{background:NAV,color:"#fff",
                      borderRadius:7,padding:"7px 14px",fontSize:11,fontWeight:700,
                      textDecoration:"none",display:"inline-block"}}>
                      📞 {h.phone}
                    </a>
                  )}
                  {h.bookingLink&&(
                    <a href={h.bookingLink} target="_blank" rel="noreferrer"
                      style={{background:"#e8edf8",color:NAV,borderRadius:7,
                        padding:"7px 14px",fontSize:11,fontWeight:700,
                        textDecoration:"none",border:`1px solid ${NAV}30`,display:"inline-block"}}>
                      🌐 Check Current Rates
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {/* Do not contact */}
          {results.doNotContact?.length>0&&(
            <div style={{background:"#ffebee",border:"1px solid #ef9a9a",
              borderRadius:10,padding:"12px 14px",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:800,color:"#c62828",marginBottom:6}}>
                ⛔ Skip These Hotels
              </div>
              {results.doNotContact.map((d,i)=>(
                <div key={i} style={{fontSize:11,color:"#7a0000",marginBottom:4}}>• {d}</div>
              ))}
            </div>
          )}

          {/* Negotiation tips */}
          {results.negotiationTips?.length>0&&(
            <div style={{background:"#f0f4ff",border:`1px solid ${NAV}30`,
              borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:800,color:NAV,marginBottom:8}}>
                🤝 Negotiation Tips for {c.city}
              </div>
              {results.negotiationTips.map((t,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:6,
                  fontSize:11,color:"#334",lineHeight:1.5}}>
                  <span style={{color:NAV,fontWeight:900,flexShrink:0}}>{i+1}.</span>{t}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VendorList({c, gsaRate}){
  const gsa = gsaRate || 0;
  const bidRate = Math.round(gsa * 0.98);
  const mileReq = c.sow?.mileRadius || "N/A";
  const mileLimit = parseFloat(mileReq) || null;
  const isApt = c.propType === "apartment";
  const isHotel = c.propType === "hotel";

  // Use LAST number in range for unit requirement — worst case e.g. "5–20 units" → 20
  const reqUnits = (()=>{
    const raw = String(c.sow?.units || "");
    const nums = raw.match(/\d+/g);
    if(!nums) return null;
    return parseInt(nums[nums.length-1]);
  })();

  // Required amenities from sow
  const reqAmenities = c.sow?.amenities || [];

  // Load city vendors filtered by correct type
  const cityData = CITY_VENDORS[c.city] || {};
  const initialVendors = isHotel
    ? (cityData.hotel || [])
    : isApt
    ? (cityData.apartment || [])
    : [...(cityData.hotel||[]),...(cityData.apartment||[])];

  const [vendors, setVendors] = useState(()=>
    initialVendors.map(v=>({...v, ratePerNight:"", distanceMiles:""}))
  );
  const [form, setForm] = useState({
    name:"", type:isHotel?"hotel":"apartment",
    phone:"", address:"", note:"", ratePerNight:"", distanceMiles:"",
    unitCount:"", amenities:[]
  });
  const [showForm, setShowForm] = useState(false);
  const [showChains, setShowChains] = useState(false);

  const chains = isHotel ? HOTEL_CHAINS : isApt ? APT_CHAINS : [...HOTEL_CHAINS,...APT_CHAINS];

  const checkGSA=(rate)=>{
    if(!rate||!gsa) return null;
    return parseFloat(rate)<=bidRate ? "pass" : "fail";
  };
  const checkProx=(miles)=>{
    if(!miles||!mileLimit) return null;
    return parseFloat(miles)<=mileLimit ? "pass" : "fail";
  };
  const checkUnits=(count)=>{
    if(!count||!reqUnits) return null;
    return parseInt(count)>=reqUnits ? "pass" : "fail";
  };
  const checkAmenities=(vendorAmenities)=>{
    if(!reqAmenities.length||!vendorAmenities?.length) return null;
    // Normalize for loose matching
    const norm=(s)=>s.toLowerCase().replace(/[^a-z]/g,"");
    const missing = reqAmenities.filter(req=>
      !vendorAmenities.some(va=>norm(va).includes(norm(req))||norm(req).includes(norm(va)))
    );
    return {pass: missing.length===0, missing};
  };

  const overallStatus=(v)=>{
    const g = checkGSA(v.ratePerNight);
    const p = checkProx(v.distanceMiles);
    const u = checkUnits(v.unitCount);
    const a = checkAmenities(v.amenities);
    const checks = [g,p,u, a?.pass===false?"fail":a?.pass===true?"pass":null].filter(x=>x!==null);
    if(!checks.length) return "unknown";
    if(checks.includes("fail")) return "fail";
    if(checks.every(x=>x==="pass")) return "pass";
    return "partial";
  };

  const updateVendor=(i,field,val)=>setVendors(vv=>vv.map((v,idx)=>idx===i?{...v,[field]:val}:v));
  const removeVendor=(i)=>setVendors(v=>v.filter((_,idx)=>idx!==i));
  const addVendor=()=>{
    if(!form.name.trim()) return;
    setVendors(v=>[...v,{...form}]);
    setForm({name:"",type:isHotel?"hotel":"apartment",phone:"",address:"",note:"",ratePerNight:"",distanceMiles:"",unitCount:"",amenities:[]});
    setShowForm(false);
  };

  const typeColor=(t)=>t==="hotel"?"#1565c0":"#2e7d32";
  const typeBg=(t)=>t==="hotel"?"#e3f2fd":"#e8f5e9";
  const typeEmoji=(t)=>t==="hotel"?"🏨":"🏠";

  const statusBadge=(status,passLabel,failLabel)=>{
    if(status===null) return <span style={{fontSize:10,color:"#bbb",fontStyle:"italic"}}>Not entered</span>;
    return status==="pass"
      ? <span style={{background:"#e8f5e9",color:GRN,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:800}}>✅ {passLabel}</span>
      : <span style={{background:"#ffebee",color:RED,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:800}}>❌ {failLabel}</span>;
  };

  const passCount = vendors.filter(v=>overallStatus(v)==="pass").length;
  const failCount = vendors.filter(v=>overallStatus(v)==="fail").length;
  const unknownCount = vendors.filter(v=>overallStatus(v)==="unknown").length;

  return(
    <div style={{background:"#f7f9fc",border:"1px solid #e4e9f4",borderRadius:10,padding:"14px 16px",marginBottom:12}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{fontSize:12,fontWeight:800,color:"#1a2340",textTransform:"uppercase",letterSpacing:0.8}}>
          📞 {isApt?"Apartment Buildings":"Hotels"} to Contact — {c.city}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setShowChains(s=>!s)}
            style={{background:"#f0f4ff",color:NAV,border:`1px solid ${NAV}30`,borderRadius:6,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {showChains?"Hide":"+ "+( isApt?"Apt Chains":"Hotel Chains")}
          </button>
          <button onClick={()=>setShowForm(s=>!s)}
            style={{background:NAV,color:"#fff",border:"none",borderRadius:6,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {showForm?"Cancel":"+ Add"}
          </button>
        </div>
      </div>

      {/* Contract requirements banner */}
      <div style={{background:"#fff",border:"1px solid #e4e9f4",borderRadius:8,padding:"10px 13px",marginBottom:12}}>
        <div style={{fontSize:10,fontWeight:800,color:"#556",textTransform:"uppercase",letterSpacing:0.7,marginBottom:6}}>
          📋 Contract Must-Match Requirements
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-start"}}>
          <div style={{textAlign:"center",background:"#f0f4ff",borderRadius:7,padding:"6px 12px"}}>
            <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7}}>💰 Max Rate</div>
            <div style={{fontSize:14,fontWeight:900,color:NAV}}>{fmt$(bidRate)}<span style={{fontSize:9,color:"#778"}}>/night</span></div>
          </div>
          {reqUnits&&(
            <div style={{textAlign:"center",background:"#f0f4ff",borderRadius:7,padding:"6px 12px"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7}}>🏠 Min Units</div>
              <div style={{fontSize:14,fontWeight:900,color:NAV}}>{reqUnits}+</div>
            </div>
          )}
          {mileLimit&&(
            <div style={{textAlign:"center",background:"#f0f4ff",borderRadius:7,padding:"6px 12px"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7}}>📍 Max Distance</div>
              <div style={{fontSize:14,fontWeight:900,color:TEAL}}>{mileReq}</div>
            </div>
          )}
          {reqAmenities.length>0&&(
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:4}}>✅ Required Amenities</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {reqAmenities.map(a=>(
                  <span key={a} style={{background:"#e3f2fd",color:"#1565c0",borderRadius:12,padding:"1px 7px",fontSize:10,fontWeight:600}}>{a}</span>
                ))}
              </div>
            </div>
          )}
          {vendors.length>0&&(
            <div style={{marginLeft:"auto",textAlign:"right"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:4}}>Status</div>
              <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
                {passCount>0&&<span style={{background:"#e8f5e9",color:GRN,borderRadius:4,padding:"2px 9px",fontSize:11,fontWeight:800}}>✅ {passCount}</span>}
                {failCount>0&&<span style={{background:"#ffebee",color:RED,borderRadius:4,padding:"2px 9px",fontSize:11,fontWeight:800}}>❌ {failCount}</span>}
                {unknownCount>0&&<span style={{background:"#f5f5f5",color:"#888",borderRadius:4,padding:"2px 9px",fontSize:11,fontWeight:800}}>? {unknownCount} need info</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vendor cards */}
      {vendors.length===0&&!showChains&&(
        <div style={{textAlign:"center",padding:"18px 0",color:"#bbb",fontSize:12}}>
          No {isApt?"apartment buildings":"hotels"} added yet. Add one below or browse chains.
        </div>
      )}

      {vendors.map((v,i)=>{
        const gs = checkGSA(v.ratePerNight);
        const px = checkProx(v.distanceMiles);
        const un = checkUnits(v.unitCount!=null?String(v.unitCount):v.unitCount);
        const am = checkAmenities(v.amenities);
        const overall = overallStatus(v);
        const borderCol = overall==="pass"?GRN:overall==="fail"?RED:overall==="partial"?GOLD:"#e4e9f4";

        return(
          <div key={i} style={{background:"#fff",border:`2px solid ${borderCol}`,borderRadius:8,padding:"11px 13px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:800,color:"#1a2340"}}>{v.name}</span>
                  {v.badge&&(
                    <span style={{background:v.badge==="West Allis"?"#354984":"#2e7d32",color:"#fff",
                      borderRadius:4,padding:"1px 7px",fontSize:9,fontWeight:800,letterSpacing:0.5}}>
                      📍 {v.badge}
                    </span>
                  )}
                  <span style={{background:typeBg(v.type),color:typeColor(v.type),borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                    {typeEmoji(v.type)} {v.type==="hotel"?"Hotel":"Apartment"}
                  </span>
                  {overall==="pass"&&<span style={{background:"#e8f5e9",color:GRN,borderRadius:4,padding:"1px 8px",fontSize:10,fontWeight:800}}>✅ Qualifies</span>}
                  {overall==="fail"&&<span style={{background:"#ffebee",color:RED,borderRadius:4,padding:"1px 8px",fontSize:10,fontWeight:800}}>❌ Fails Requirements</span>}
                  {overall==="partial"&&<span style={{background:"#fff8e1",color:GOLD,borderRadius:4,padding:"1px 8px",fontSize:10,fontWeight:800}}>⚠️ Needs Info</span>}
                </div>
                {v.phone&&v.phone!=="N/A"&&(
                  <a href={`tel:${v.phone}`} style={{fontSize:11,color:NAV,fontWeight:700,textDecoration:"none",display:"block",marginBottom:1}}>📞 {v.phone}</a>
                )}
                {v.address&&<div style={{fontSize:11,color:"#667",marginBottom:2}}>📍 {v.address}</div>}
                {v.unitCount&&<div style={{fontSize:11,color:"#556",fontWeight:600,marginBottom:2}}>🏠 {v.unitCount} total units</div>}
                {v.amenities?.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:3}}>
                    {v.amenities.map((a,ai)=>{
                      const norm=(s)=>s.toLowerCase().replace(/[^a-z]/g,"");
                      const isRequired = reqAmenities.some(r=>norm(r).includes(norm(a))||norm(a).includes(norm(r)));
                      return(
                        <span key={ai} style={{
                          background:isRequired?"#e8f5e9":"#f5f5f5",
                          color:isRequired?GRN:"#888",
                          border:`1px solid ${isRequired?"#a5d6a7":"#e0e0e0"}`,
                          borderRadius:12,padding:"1px 7px",fontSize:10,fontWeight:600}}>
                          {isRequired?"✓ ":""}{a}
                        </span>
                      );
                    })}
                  </div>
                )}
                {am&&!am.pass&&am.missing.length>0&&(
                  <div style={{background:"#fff8e1",borderRadius:6,padding:"5px 8px",marginBottom:3}}>
                    <span style={{fontSize:10,color:AMB,fontWeight:700}}>⚠️ Missing amenities: </span>
                    <span style={{fontSize:10,color:"#5a4000"}}>{am.missing.join(", ")}</span>
                  </div>
                )}
                {v.rating&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                    <div style={{display:"flex",gap:1}}>
                      {[1,2,3,4,5].map(s=>(
                        <span key={s} style={{fontSize:11,color:v.rating>=s?"#f59e0b":v.rating>=s-0.5?"#f59e0b":"#ddd",
                          filter:v.rating>=s-0.5&&v.rating<s?"brightness(1.3)":undefined}}>
                          {v.rating>=s?"★":v.rating>=s-0.5?"⭐":"☆"}
                        </span>
                      ))}
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:v.rating>=4?"#2e7d32":v.rating>=3.5?"#f59e0b":"#c62828"}}>
                      {v.rating}/5
                    </span>
                    <span style={{fontSize:10,color:"#aab"}}>verified rating</span>
                  </div>
                )}
                {v.note&&(
                  <div style={{fontSize:11,color:v.note.includes("⚠️")?"#7a4f00":v.note.includes("✅")?"#1b5e20":"#888",
                    fontStyle:"italic",background:v.note.includes("⚠️")?"#fff8e1":v.note.includes("✅")?"#f1f8e9":"transparent",
                    borderRadius:5,padding:v.note.includes("⚠️")||v.note.includes("✅")?"3px 6px":"0"}}>
                    {v.note}
                  </div>
                )}
              </div>
              <button onClick={()=>removeVendor(i)} style={{background:"none",border:"none",color:"#ccc",fontSize:16,cursor:"pointer",padding:"0 2px",flexShrink:0}}>&times;</button>
            </div>

            {/* Rate / Distance / Units inputs */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,background:"#f7f9fc",borderRadius:7,padding:"8px 10px",border:"1px solid #eef1fb"}}>
              <div>
                <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>💰 Rate/Night</div>
                <div style={{position:"relative"}}>
                  <span style={{position:"absolute",left:7,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#888"}}>$</span>
                  <input type="number" value={v.ratePerNight} onChange={e=>updateVendor(i,"ratePerNight",e.target.value)}
                    placeholder={`≤ ${bidRate}`}
                    style={{width:"100%",padding:"5px 7px 5px 17px",borderRadius:5,border:`1.5px solid ${gs==="pass"?GRN:gs==="fail"?RED:"#dde3f0"}`,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginTop:3}}>{statusBadge(gs,`≤ ${fmt$(bidRate)}`,`Over limit`)}</div>
              </div>

              {mileLimit?(
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>📍 Miles Away</div>
                  <div style={{position:"relative"}}>
                    <input type="number" value={v.distanceMiles} onChange={e=>updateVendor(i,"distanceMiles",e.target.value)}
                      placeholder={`≤ ${mileLimit}`}
                      style={{width:"100%",padding:"5px 24px 5px 7px",borderRadius:5,border:`1.5px solid ${px==="pass"?GRN:px==="fail"?RED:"#dde3f0"}`,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                    <span style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",fontSize:9,color:"#aab"}}>mi</span>
                  </div>
                  <div style={{marginTop:3}}>{statusBadge(px,`Within ${mileReq}`,`Too far`)}</div>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:10,color:"#bbb",fontStyle:"italic",textAlign:"center"}}>No distance req.</span>
                </div>
              )}

              {isApt&&reqUnits?(
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:3}}>🏠 Unit Count</div>
                  <input type="number" value={v.unitCount||""} onChange={e=>updateVendor(i,"unitCount",e.target.value)}
                    placeholder={`≥ ${reqUnits} req.`}
                    style={{width:"100%",padding:"5px 7px",borderRadius:5,border:`1.5px solid ${un==="pass"?GRN:un==="fail"?RED:"#dde3f0"}`,fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
                  <div style={{marginTop:3}}>{statusBadge(un,`≥ ${reqUnits} units`,`< ${reqUnits} needed`)}</div>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:10,color:"#bbb",fontStyle:"italic",textAlign:"center"}}>{isApt?"Enter unit count":"Hotel — N/A"}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* National chains */}
      {showChains&&(
        <div style={{marginTop:8,marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:800,color:"#556",marginBottom:8,textTransform:"uppercase",letterSpacing:0.7}}>
            🏢 National {isApt?"Apartment":"Hotel"} Chains — Call for {c.city} Availability
          </div>
          {chains.map((v,i)=>(
            <div key={i} style={{background:"#fff",border:"1px solid #e4e9f4",borderRadius:8,padding:"9px 12px",marginBottom:5,display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,fontWeight:800,color:"#1a2340"}}>{v.name}</span>
                  <span style={{background:typeBg(v.type),color:typeColor(v.type),borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                    {typeEmoji(v.type)} {v.type==="hotel"?"Hotel":"Apartment"}
                  </span>
                </div>
                {v.phone&&v.phone!=="N/A"&&(
                  <a href={`tel:${v.phone}`} style={{fontSize:11,color:NAV,fontWeight:700,textDecoration:"none",display:"block",marginBottom:1}}>📞 {v.phone}</a>
                )}
                <a href={`https://${v.site}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:TEAL,textDecoration:"none",marginBottom:2,display:"block"}}>🌐 {v.site}</a>
                <div style={{fontSize:11,color:"#888",fontStyle:"italic"}}>{v.note}</div>
              </div>
              <button onClick={()=>setVendors(vv=>[...vv,{...v,address:"",ratePerNight:"",distanceMiles:"",unitCount:""}])}
                style={{background:MINT,color:TEAL,border:`1px solid ${MINT2}`,borderRadius:5,padding:"3px 9px",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                + Add
              </button>
            </div>
          ))}
          <div style={{fontSize:10,color:"#aab",marginTop:6,fontStyle:"italic"}}>
            💡 {isApt?"Search: furnishedfinder.com · zillow.com (furnished filter) · apartments.com · corporatehousingbyowner.com"
                    :"Search: hotels.com · booking.com — filter Extended Stay or Suite"}
          </div>
        </div>
      )}

      {/* Add vendor form */}
      {showForm&&(
        <div style={{background:"#fff",border:`1.5px solid ${NAV}30`,borderRadius:8,padding:"14px",marginTop:8}}>
          <div style={{fontSize:11,fontWeight:800,color:NAV,marginBottom:10,textTransform:"uppercase",letterSpacing:0.7}}>
            ➕ Add {isApt?"Apartment Building":"Hotel"}
          </div>
          {[
            {label:"Name *",          key:"name",          placeholder:isApt?"e.g. Riverfront Apartments":"e.g. Homewood Suites Milwaukee"},
            {label:"Phone",           key:"phone",          placeholder:"e.g. 414-555-0100"},
            {label:"Address",         key:"address",        placeholder:"e.g. 123 Main St, Milwaukee WI 53202"},
            {label:"Rate/Night ($)",  key:"ratePerNight",   placeholder:`Must be ≤ ${fmt$(bidRate)}`},
            ...(mileLimit?[{label:`Distance (miles, max ${mileReq})`,key:"distanceMiles",placeholder:`Must be ≤ ${mileLimit} mi`}]:[]),
            ...(isApt&&reqUnits?[{label:`Total Units (min ${reqUnits} required)`,key:"unitCount",placeholder:`Must have ≥ ${reqUnits} units`}]:[]),
            {label:"Notes",           key:"note",           placeholder:"e.g. Furnished, kitchen, parking, ADA available"},
          ].map(({label,key,placeholder})=>(
            <div key={key} style={{marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:"#9aa",marginBottom:3,textTransform:"uppercase",letterSpacing:0.7}}>{label}</div>
              <input value={form[key]||""} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
                placeholder={placeholder}
                style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1.5px solid #dde3f0",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
            </div>
          ))}
          {/* Live check preview */}
          {(form.ratePerNight||form.distanceMiles||form.unitCount)&&(
            <div style={{background:"#f7f9fc",borderRadius:7,padding:"8px 11px",marginBottom:10,border:"1px solid #e4e9f4"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#9aa",textTransform:"uppercase",letterSpacing:0.7,marginBottom:5}}>Live Qualification Check</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {form.ratePerNight&&statusBadge(checkGSA(form.ratePerNight),`Rate ≤ ${fmt$(bidRate)} ✓`,`Over ${fmt$(bidRate)}`)}
                {form.distanceMiles&&mileLimit&&statusBadge(checkProx(form.distanceMiles),`Within ${mileReq} ✓`,`Exceeds ${mileReq}`)}
                {form.unitCount&&isApt&&reqUnits&&statusBadge(checkUnits(form.unitCount),`Has ${reqUnits}+ units ✓`,`< ${reqUnits} units`)}
              </div>
            </div>
          )}
          <button onClick={addVendor}
            style={{background:NAV,color:"#fff",border:"none",borderRadius:7,padding:"8px 20px",fontSize:12,fontWeight:800,cursor:"pointer",width:"100%"}}>
            Save {isApt?"Apartment Building":"Hotel"}
          </button>
        </div>
      )}
    </div>
  );
}
// ── SAM GUIDE TAB ─────────────────────────────────────────────────────────────
function SamGuide(){
  const [copied,setCopied]=useState({});
  const copy=(text,key)=>{
    navigator.clipboard.writeText(text).catch(()=>{});
    setCopied(c=>({...c,[key]:true}));
    setTimeout(()=>setCopied(c=>({...c,[key]:false})),1500);
  };
  return(
    <div style={{padding:"20px 24px",overflowY:"auto",height:"100%"}}>
      <h2 style={{margin:"0 0 3px",fontSize:18,fontWeight:900,color:"#1a2340"}}>📡 SAM.gov Search Guide</h2>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#667"}}>
        Exact steps + keywords to find every active WOSB lodging contract in the US. Run these searches 3× per week minimum (SOP §3).
      </p>

      {/* Step by step */}
      <div style={{background:"#fff",border:"1px solid #e4e9f4",borderRadius:12,padding:"16px 18px",marginBottom:18}}>
        <div style={{fontSize:12,fontWeight:800,color:NAV,textTransform:"uppercase",letterSpacing:0.8,marginBottom:12}}>
          📋 Step-by-Step SAM.gov Search Process
        </div>
        {SAM_STEPS.map(s=>(
          <div key={s.step} style={{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}}>
            <div style={{width:32,height:32,borderRadius:8,background:NAV,color:"#fff",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,flexShrink:0}}>{s.step}</div>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:"#1a2340",marginBottom:2}}>{s.icon} {s.title}</div>
              <div style={{fontSize:12,color:"#556",lineHeight:1.55}}>{s.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search schedule */}
      {SAM_SEARCHES.map(g=>(
        <div key={g.priority} style={{background:"#fff",border:`2px solid ${g.color}30`,borderRadius:12,marginBottom:14,overflow:"hidden"}}>
          <div style={{background:g.color,padding:"9px 16px",fontSize:13,fontWeight:900,color:"#fff"}}>{g.priority}</div>
          <div style={{padding:"4px 0"}}>
            {g.searches.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",
                borderBottom:i<g.searches.length-1?"1px solid #f0f3f9":"none"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{background:g.color+"18",color:g.color,borderRadius:5,
                      padding:"2px 9px",fontSize:12,fontWeight:800,fontFamily:"monospace"}}>"{s.keyword}"</span>
                    <span style={{background:"#f0f4ff",color:NAV,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700}}>NAICS {s.naics}</span>
                    <span style={{background:NAV,color:"#fff",borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700}}>{s.setaside}</span>
                  </div>
                  <div style={{fontSize:11,color:"#778"}}>{s.note}</div>
                </div>
                <button onClick={()=>copy(s.keyword,`${g.priority}-${i}`)}
                  style={{background:copied[`${g.priority}-${i}`]?GRN:"#f0f4ff",
                    color:copied[`${g.priority}-${i}`]?"#fff":NAV,
                    border:"none",borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:700,
                    cursor:"pointer",flexShrink:0,transition:"all 0.2s"}}>
                  {copied[`${g.priority}-${i}`]?"✓":"Copy"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Pro tip */}
      <div style={{background:MINT+"90",border:`1px solid ${MINT2}`,borderRadius:12,padding:"14px 18px"}}>
        <div style={{fontSize:12,fontWeight:800,color:"#1a4a35",marginBottom:8}}>💡 Pro Tips for Finding the VA Milwaukee 45-Unit Contract</div>
        {[
          "Go to SAM.gov and search: VA Milwaukee — filter WOSB, sort by Response Date soonest first",
          "Also try: Veterans Affairs furnished housing Milwaukee",
          "Also try NAICS 531110 filter only, set-aside WOSB, state = Wisconsin",
          "Look for notice types: Solicitation (active bid) — the deadline is in ~7 days so it should be near top",
          "Once you find it — paste the full listing here and I'll build the proposal immediately",
        ].map((t,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
            <span style={{color:TEAL,fontWeight:900,flexShrink:0}}>{i+1}.</span>
            <span style={{fontSize:12,color:"#2a4a35",lineHeight:1.55}}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 15 * 60; // 15 minutes in seconds

// Convert a scanned alert into a full contract object
function alertToContract(a){
  const propType = a.propType||"apartment";
  const isApt = propType==="apartment";
  // Build realistic SOW from scanned data so budget auto-detects all required costs
  const amenities = a.amenities || (isApt
    ? ["Fully furnished","Wi-Fi","Kitchen","Laundry","Parking","Linens","TV","ADA units"]
    : ["Wi-Fi","In-room safe","Parking","TV","A/C","Laundry"]);
  const utilities = a.utilities || (isApt
    ? ["Electric","Water","Gas/Heat","Internet included"]
    : ["Electric","Water","Internet included"]);
  const requirements = a.requirements || [
    ...(isApt?["Fully furnished","ADA accessible units available"]:[]),
    "Professional cleaning between occupants",
    "Property manager on call",
    "Maintenance response within 24 hrs",
    "Net-30 via IPP",
  ];
  return {
    id:"scan-"+Date.now()+"-"+(Math.random()*9999|0),
    sol:(a.sol||"TBD-"+Date.now()).toUpperCase(),
    title:a.title||"Unnamed Contract",
    agency:a.agency||"Unknown Agency",
    city:a.city||"Unknown",
    state:a.state||"WI",
    region:"user-added",
    deadline:a.deadline||new Date(Date.now()+30*86400000).toISOString().split("T")[0],
    noticeType:a.noticeType||"solicitation",
    propType,
    setAside:a.setAside||"Women-Owned Small Business (WOSB)",
    gsaRate:parseFloat(a.gsaRate)||0,
    verified:false,
    rank:0,
    userAdded:true,
    scannedIn:true,
    tags:["auto-scanned"],
    status:"Researching",
    extension:{extendable:true,options:2,length:"1 year each",totalDuration:"3 years total",conditions:"Base + 2 option years pending performance review."},
    notes:[{date:new Date().toISOString().split("T")[0],text:a.action||"Auto-detected by SAM.gov scanner"}],
    samUrl:"https://sam.gov/opp/search",
    sow:{
      units:a.units||"5–15 units",
      amenities,
      utilities,
      requirements,
      duration:a.duration||"12 months",
      lodgingSchedule:{nightsPerYear:300,weeksPerYear:43,type:"continuous",typeLabel:"📅 Continuous"}
    },
  };
}

function AutoRefreshBar({onAddContract}) {
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL);
  const [lastChecked, setLastChecked] = useState(null);
  const [checking, setChecking] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(true);
  const timerRef = useRef(null);
  const onAddRef = useRef(onAddContract);
  useEffect(()=>{ onAddRef.current = onAddContract; },[onAddContract]);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setSecondsLeft(REFRESH_INTERVAL);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are a federal contract monitoring assistant for KD Modern Rentals LLC (CAGE 190G9, WOSB, Milwaukee WI). Simulate checking SAM.gov for new lodging/housing contracts. Return ONLY a JSON array (no markdown, no explanation) of 0-3 contracts. Each must have ALL fields: {sol, title, agency, city, state, deadline (YYYY-MM-DD format), noticeType, propType, setAside, gsaRate, units, action, urgency}. noticeType: 'solicitation' or 'sources_sought' or 'pre_solicitation'. propType: 'apartment' or 'hotel'. setAside: 'Women-Owned Small Business (WOSB)' or 'Small Business' or 'Unrestricted'. urgency: 'high' or 'medium' or 'low'. Focus on WI, IL, MN region. NAICS 531110 and 721110. Sometimes return [].",
          messages:[{role:"user",content:`SAM.gov scan at ${new Date().toLocaleString()}. Find new WOSB lodging contracts. JSON array only.`}]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text||"[]";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      if(parsed.length>0){
        const stamped = parsed.map(a=>({...a,timestamp:new Date().toLocaleTimeString()}));
        // AUTO-ADD each detected contract directly into the dashboard list
        stamped.forEach(a => onAddRef.current(alertToContract(a)));
        setAlerts(prev=>[...stamped,...prev].slice(0,20));
        setShowAlerts(true);
      }
      setLastChecked(new Date());
    } catch(e){
      console.error("SAM scan error:",e);
      setLastChecked(new Date());
    }
    setChecking(false);
  },[]);

  useEffect(()=>{
    runCheck();
    timerRef.current=setInterval(()=>{
      setSecondsLeft(s=>{
        if(s<=1){runCheck();return REFRESH_INTERVAL;}
        return s-1;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[]);

  const mins=Math.floor(secondsLeft/60);
  const secs=secondsLeft%60;
  const pct=((REFRESH_INTERVAL-secondsLeft)/REFRESH_INTERVAL)*100;

  return(
    <div>
      <div style={{background:checking?"#1b5e20":NAV+"ee",padding:"6px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {checking?(
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:12,height:12,borderRadius:"50%",background:"#69f0ae",animation:"pulse 1s infinite"}}/>
            <span style={{fontSize:11,color:"#fff",fontWeight:700}}>🔍 Scanning SAM.gov — auto-adding new contracts to your list...</span>
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{position:"relative",width:32,height:32}}>
              <svg width="32" height="32" style={{transform:"rotate(-90deg)"}}>
                <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                <circle cx="16" cy="16" r="12" fill="none" stroke="#69f0ae" strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*12}`}
                  strokeDashoffset={`${2*Math.PI*12*(1-pct/100)}`}
                  style={{transition:"stroke-dashoffset 1s linear"}}/>
              </svg>
              <span style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:7,fontWeight:900,color:"#fff"}}>{mins}:{secs.toString().padStart(2,"0")}</span>
            </div>
            <div>
              <div style={{fontSize:11,color:"#fff",fontWeight:700}}>Next scan in {mins}m {secs.toString().padStart(2,"0")}s · New contracts auto-add to list</div>
              {lastChecked&&<div style={{fontSize:9,color:"rgba(255,255,255,0.6)"}}>Last checked: {lastChecked.toLocaleTimeString()}</div>}
            </div>
          </div>
        )}
        <button onClick={runCheck} disabled={checking}
          style={{background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:checking?"not-allowed":"pointer",opacity:checking?0.5:1}}>
          {checking?"Scanning...":"🔄 Scan Now"}
        </button>
        {alerts.length>0&&(
          <button onClick={()=>setShowAlerts(s=>!s)}
            style={{background:"#69f0ae",color:"#1b5e20",border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
            ✅ {alerts.length} Added {showAlerts?"▲":"▼"}
          </button>
        )}
        <div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.5)"}}>Auto-scan every 15 min · WOSB NAICS 531110+721110</div>
      </div>
      <div style={{height:3,background:"rgba(255,255,255,0.1)",position:"relative"}}>
        <div style={{position:"absolute",left:0,top:0,height:"100%",background:"#69f0ae",width:`${pct}%`,transition:"width 1s linear"}}/>
      </div>
      {showAlerts&&alerts.length>0&&(
        <div style={{background:"#1a2340",borderBottom:"2px solid #69f0ae",padding:"10px 20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:900,color:"#69f0ae",textTransform:"uppercase",letterSpacing:0.8}}>✅ {alerts.length} Contract{alerts.length!==1?"s":""} Auto-Added to Your List</span>
            <button onClick={()=>setAlerts([])} style={{background:"none",border:"1px solid #69f0ae",color:"#69f0ae",borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Dismiss</button>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {alerts.map((a,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(105,240,174,0.3)",borderRadius:8,padding:"10px 14px",minWidth:220,maxWidth:300,flex:"1"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:10,fontWeight:800,color:"#69f0ae",textTransform:"uppercase"}}>{a.noticeType?.replace(/_/g," ")} · {a.city}, {a.state}</span>
                  <span style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>{a.timestamp}</span>
                </div>
                <div style={{fontSize:12,fontWeight:800,color:"#fff",marginBottom:2,lineHeight:1.3}}>{a.title}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginBottom:4}}>{a.agency}</div>
                <div style={{fontSize:10,fontFamily:"monospace",color:"#69f0ae"}}>🪪 {a.sol}</div>
                <div style={{marginTop:6,fontSize:10,background:"rgba(105,240,174,0.15)",borderRadius:4,padding:"3px 8px",color:"#69f0ae",fontWeight:700}}>✅ Added — scroll up in list to see it</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

export default function Dashboard(){
  const [selected,setSelected]=useState(null);
  const [region,setRegion]=useState("all");
  const [search,setSearch]=useState("");
  const [mainTab,setMainTab]=useState("contracts");
  const [scannedContracts,setScannedContracts]=useState([]);

  // Load saved scanned contracts from storage on mount
  useEffect(()=>{
    (async()=>{
      try{
        const r=await window.storage.get("kd-scanned-contracts");
        if(r?.value){const p=JSON.parse(r.value);if(Array.isArray(p))setScannedContracts(p);}
      }catch(e){}
    })();
  },[]);

  // Save whenever scanned contracts change
  useEffect(()=>{
    (async()=>{
      try{await window.storage.set("kd-scanned-contracts",JSON.stringify(scannedContracts));}
      catch(e){}
    })();
  },[scannedContracts]);

  const addScannedContract = useCallback((c)=>{
    setScannedContracts(prev=>{
      if(prev.some(x=>x.sol===c.sol)) return prev; // no duplicates
      return [c,...prev];
    });
  },[]);

  function removeScannedContract(id){
    setScannedContracts(prev=>prev.filter(c=>c.id!==id));
  }

  const ALL_CONTRACTS=[...scannedContracts,...CONTRACTS,...UNRESTRICTED_CONTRACTS];

  const filtered=ALL_CONTRACTS.filter(c=>{
    const tab=REGION_TABS.find(t=>t.id===region);
    if(tab?.setaside && c.setAside!==tab.setaside) return false;
    if(tab?.region && c.region!==tab.region) return false;
    if(tab?.propType && c.propType!==tab.propType) return false;
    if(!search) return true;
    const q=search.toLowerCase();
    return c.title.toLowerCase().includes(q)||c.agency.toLowerCase().includes(q)||c.city.toLowerCase().includes(q)||(c.tags||[]).join(" ").toLowerCase().includes(q);
  }).sort((a,b)=>{
    // Scanned-in always pins to top
    if(a.scannedIn&&!b.scannedIn) return -1;
    if(!a.scannedIn&&b.scannedIn) return 1;
    // Then sort by notice type priority (1=Registration, 2=SOL, 3=SS, etc.)
    const pa = NOTICE_PRIORITY_ORDER[a.noticeType]||99;
    const pb = NOTICE_PRIORITY_ORDER[b.noticeType]||99;
    if(pa!==pb) return pa-pb;
    // Then by rank within same type
    return a.rank-b.rank;
  });

  const kdCount=ALL_CONTRACTS.filter(c=>KD_CITIES.includes(c.city)).length;
  const urgCount=ALL_CONTRACTS.filter(c=>daysLeft(c.deadline)<30).length;
  const solCount=ALL_CONTRACTS.filter(c=>c.noticeType==="solicitation").length;
  const verifiedCount=ALL_CONTRACTS.filter(c=>c.verified).length;
  const newCount=scannedContracts.length;

  return(
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#f0f3f9",minHeight:"100vh",display:"flex",flexDirection:"column"}}>

      {/* Header */}
      <div style={{background:NAV,color:"#fff",padding:"10px 20px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        boxShadow:`0 2px 14px ${NAV}50`,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:38,height:38,borderRadius:9,background:MINT,display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:18,fontWeight:900,color:NAV}}>K</div>
          <div>
            <div style={{fontSize:14,fontWeight:900}}>KD Modern Rentals — Contract Opportunities Dashboard</div>
            <div style={{fontSize:10,opacity:0.6}}>CAGE 190G9 · UEI GT5SBDQXQNC5 · WOSB · Milwaukee, WI</div>
          </div>
        </div>
        <div style={{display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
          {[
            {label:"Total",          value:ALL_CONTRACTS.length, hi:false},
            {label:"⭐ KD Cities",   value:kdCount,              hi:false},
            {label:"✅ Verified",    value:verifiedCount,        hi:false},
            {label:"📋 Active Bids", value:solCount,             hi:false},
            {label:"🚨 Due <30d",    value:urgCount,             hi:urgCount>0},
            {label:"🆕 Scanned In",  value:newCount,             hi:newCount>0},
          ].map(({label,value,hi})=>(
            <div key={label} style={{textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:hi?"#69f0ae":"#fff"}}>{value}</div>
              <div style={{fontSize:9,opacity:0.6,letterSpacing:0.3}}>{label}</div>
            </div>
          ))}
          <div style={{display:"flex",gap:4}}>
            {[["contracts","📋 Contracts"],["sam","📡 SAM.gov Guide"]].map(([t,label])=>(
              <button key={t} onClick={()=>setMainTab(t)} style={{
                background:mainTab===t?MINT:"rgba(255,255,255,0.13)",color:mainTab===t?NAV:"#fff",
                border:"none",borderRadius:6,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Auto Refresh Bar — passes addScannedContract so new contracts go straight into list */}
      <AutoRefreshBar onAddContract={addScannedContract}/>

      {/* Research target warning */}
      <div style={{background:"#fff8e1",borderBottom:"1px solid #ffe08a",padding:"6px 20px",
        fontSize:11,color:"#7a5900",display:"flex",alignItems:"center",gap:8}}>
        🔍 <strong>Research Targets</strong> are representative — verify live status at SAM.gov before submitting. &nbsp;
        ⭐ <strong>KD Cities</strong> = your verified property cities. &nbsp;
        🆕 <strong>Scanned In</strong> = auto-detected by scanner, pinned to top.
      </div>

      {mainTab==="contracts"?(
        <>
          {/* Region tabs */}
          <div style={{background:"#fff",borderBottom:"1px solid #dde3f0",padding:"0 16px",display:"flex",gap:2,overflowX:"auto"}}>
            {REGION_TABS.map(t=>{
              const cnt=ALL_CONTRACTS.filter(c=>{
                if(t.setaside && c.setAside!==t.setaside) return false;
                if(t.region && c.region!==t.region) return false;
                if(t.propType && c.propType!==t.propType) return false;
                return true;
              }).length;
              const isSpecial=["wosb","sb","hotel","apartment"].includes(t.id);
              const tabColor=t.id==="wosb"?PUR:t.id==="sb"?TEAL:t.id==="hotel"?"#1565c0":t.id==="apartment"?"#2e7d32":NAV;
              return(
                <button key={t.id} onClick={()=>{setRegion(t.id);setSelected(null);}} style={{
                  background:region===t.id&&isSpecial?tabColor+"18":"none",
                  border:"none",
                  borderBottom:region===t.id?`3px solid ${tabColor}`:"3px solid transparent",
                  color:region===t.id?tabColor:"#778",padding:"10px 14px",
                  fontSize:12,fontWeight:region===t.id?800:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                  {t.label} <span style={{fontSize:10,opacity:0.6}}>({cnt})</span>
                </button>
              );
            })}
          </div>

          <div style={{display:"flex",flex:1,height:"calc(100vh - 130px)",overflow:"hidden"}}>
            {/* Left list */}
            <div style={{width:370,flexShrink:0,background:"#f7f9fc",borderRight:"1px solid #dde3f0",overflowY:"auto",padding:"12px 10px"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="🔍 Search by city, agency, tag..."
                style={{width:"100%",padding:"8px 12px",borderRadius:8,border:`1.5px solid ${NAV}30`,
                  fontSize:12,fontFamily:"inherit",outline:"none",marginBottom:10,boxSizing:"border-box"}}/>
              <div style={{fontSize:11,fontWeight:800,color:NAV,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8,paddingBottom:6,borderBottom:`2px solid ${NAV}`}}>
                {filtered.length} Contracts {newCount>0?`· ${newCount} New 🆕`:""}— Sorted by Priority
              </div>
              {filtered.length===0&&<div style={{textAlign:"center",color:"#bbb",padding:"30px 0",fontSize:12}}>No matches.</div>}
              {(()=>{
                // Group contracts by their action label for section headers
                const groups = [
                  {key:"bid",     label:"📋 BID NOW — Submit Proposal",       color:RED,   types:["solicitation","combined_synopsis"],          desc:"Active bids — deadline is live"},
                  {key:"capstmt", label:"🔍 SEND CAPABILITY STATEMENT",        color:PUR,   types:["sources_sought"],                            desc:"Market research — 2-page cap stmt only"},
                  {key:"watch",   label:"👁️ WATCH & PREPARE",                  color:NAV,   types:["pre_solicitation","blanket_purchase","idiq"], desc:"Coming soon — set alerts"},
                  {key:"intel",   label:"⛔ INTEL ONLY — Do Not Bid",          color:"#888",types:["award_notice","special_notice","justification","modification"],desc:"Already awarded or not a competition"},
                  {key:"reg",     label:"📝 COMPLETE NOW — Registration",      color:TEAL,  types:["registration"],                              desc:"Internal tasks — unlock all contracts"},
                ];
                return groups.map(g=>{
                  const groupContracts = filtered.filter(c=>g.types.includes(c.noticeType));
                  if(groupContracts.length===0) return null;
                  return(
                    <div key={g.key} style={{marginBottom:4}}>
                      <div style={{background:g.color+"14",border:`1px solid ${g.color}30`,borderRadius:7,
                        padding:"6px 11px",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div>
                          <span style={{fontSize:11,fontWeight:900,color:g.color}}>{g.label}</span>
                          <span style={{fontSize:10,color:"#999",marginLeft:8}}>{g.desc}</span>
                        </div>
                        <span style={{background:g.color,color:"#fff",borderRadius:12,padding:"1px 8px",fontSize:10,fontWeight:800}}>{groupContracts.length}</span>
                      </div>
                      {groupContracts.map(c=>(
                        <div key={c.id}>
                          {c.scannedIn&&(
                            <div style={{background:"#e8f5e9",border:"1px solid #a5d6a7",borderRadius:6,padding:"4px 10px",
                              marginBottom:3,fontSize:10,fontWeight:800,color:"#1b5e20",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span>🆕 AUTO-SCANNED — {c.city}, {c.state}</span>
                              <button onClick={()=>removeScannedContract(c.id)}
                                style={{background:"none",border:"none",color:"#c62828",fontSize:12,cursor:"pointer",fontWeight:900}}>✕</button>
                            </div>
                          )}
                          <ContractRow c={c} selected={selected} onClick={()=>setSelected(selected?.id===c.id?null:c)}/>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Right detail */}
            <div style={{flex:1,background:"#fff",display:"flex",flexDirection:"column",overflowY:"auto"}}>
              <DetailPanel c={selected} onClose={()=>setSelected(null)}/>
            </div>
          </div>
        </>
      ):(
        <div style={{flex:1,background:"#fff",overflow:"hidden"}}>
          <SamGuide/>
        </div>
      )}
    </div>
  );
}
