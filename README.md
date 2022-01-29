# bitnet

My collection of bitburner scripts. 

I've mostly moved to using this https://github.com/malaclypse2/bitburner-scripts-1 code now, but there's still a fancy status HUD, and my manual interaction tools.

Tagged releases probably work. The main branch may or may not work at any given time. I sometimes make live updates there as I develop, which means I sometimes check in broken code while I'm testing.

Everything expects to live in the /scripts/ directory.

net.js is the command and control system.

net-monitor.js runs some semi-fancy monitors of what the system is doing.

bitlib.js tries to consolidate non-application specific code

![image](https://user-images.githubusercontent.com/9218823/148892837-e9ce5d75-83dc-4628-8cec-bbf8b14aa002.png)

alias net="run /scripts/net.js"

then play around with:

net monitor
net mon targets1up
net monitor targets2up
net start
net stop
net restart
net tail
net tail <subsystem>

  etc.
