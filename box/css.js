export let css=`body{
	--prilt:#E0E0BC;
	--pri:#CCCCAE;
	--pridk:#B8B89C;
	--successlt:#00F000;
	--success:#00D200;
	--successdk:#00B400;
	--errlt:#F00000;
	--err:#C80000;
	--errdk:#A00000;
	--seclt:#B4AEAE;
	--sec:#969090;
	--secdk:#787272;
	--warnlt:#F0F000;
	--warn:#C8C800;
	--warndk:#A0A000;
	--infolt:#69f;
	--info:#36c;
	--infodk:#039;
	--welllt:#444;
	--well:#222;
	--white:#fff;
	--black:#1E1E1E;
	--hp:#dd3434;
	--money:#ffd700;
	--hack:#adff2f;
	--combat:#faffdf;
	--cha:#a671d1;
	--int:#6495ed;
	--rep:#faffdf;
	--disabled:#66cfbc;
	--bgpri:#1E1E1E;
	--bgsec:#252525;
	--button:#333;
	--ff:"Jetbrains Mono";
  }
  .box *{
	font-size:inherit;
	color:inherit;
	vertical-align:middle;
	margin:0;
	font-family:inherit;
	font-weight:500;
  }
  .box{
	font-family:var(--ff);
	position:fixed;
	font-size:14px;
	background:var(--bgsec);
	box-shadow:0 0 0 2px var(--welllt);
	line-height:1.5;
	color:var(--pri);
	width:max-content;
	padding:1px;
	white-space: pre-wrap;
  }
  .box.min *:not(.title, .title *){
	display:none;
  }
  .box.prompt{
	box-shadow:0 0 0 2px var(--welllt), 0 0 0 10000px #0007;
	min-width:400px;
  }
  .box .title{
	user-select:none;
	display:flex;
	background:var(--bgpri);
	font-size:18px;
	white-space:pre;
	color:var(--pri);
	cursor:move;
	padding:0px 35px;
	margin-bottom:1px;
  }
  .box.min .title{
	padding:0 36px 0 0;
  }
  .box .title span{
	margin:0 auto;
  }
  .box .title a{
	cursor:pointer;
	font-family:"codicon";
  }
  .box .toggle::after{
	content:"";
  }
  .box.min .toggle::after{
	content:"";
  }
  .box .toggle{
	margin-left:0px;
  }
  .box .close{
	margin-right:-36px;
  }
  .box .resizer{
	overflow:hidden;
	resize:both;
  }
  .box .scroller{
	overflow:scroll;
	width:100%;
	height:100%;
  }
  .box .timestamp{
	color:var(--int);
  }
  .box :is(input,select,button,textarea){
	outline:none;
	border:none;
  }
  .box :is(textarea,.log){
	height:100%;
	width:100%;
	overflow-y:scroll;
	font-size:12px;
	background:none;
	padding:0px;
  }
  .box :is(input,select){
	padding:3px;
	background:var(--well);
	border-bottom:1px solid var(--prilt);
	transition:border-bottom 250ms;
  }
  .box input[type=number]{
	width:80px;
  }
  .box input:hover{
	border-bottom:1px solid var(--black);
  }
  .box input:focus{
	border-bottom:1px solid var(--prilt);
  }
  .box :is(button,input[type=checkbox]){
	background:var(--button);
	transition:background 250ms;
	border:1px solid var(--well);
  }
  .box :is(button,input[type=checkbox]):hover{
	background:var(--bgsec);
  }
  .box :is(button,input[type=checkbox]):focus, .box select{
	border:1px solid var(--welllt);
  }
  .box button{
	padding:6px 8px;
	user-select:none;
  }
  .box input[type=checkbox]{
	appearance:none;
	display:inline-flex;
	align-items:center;
	justify-content:center;
	width:22px;
	height:22px;
  }
  .box input[type=checkbox]:checked::after{
	content:"✓";
	font-size:24px;
  }
  .box .g2{
	display:grid;
	grid-columns-template:max-content max-content;
	column-gap:10px;
	grid-auto-rows:minmax(30px, max-content);
	align-items:center;
	margin:3px;
  }
  .box .g2 > *:nth-child(odd){
	justify-self:end;
	grid-column:1 / span 1;
  }
  .box .g2 > *:nth-child(even){
	justify-self:start;
	grid-column:2 / span 1;
  }
  `;