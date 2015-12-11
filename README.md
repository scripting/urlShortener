#### urlShortener

A JavaScript URL shortener running in Node.js. 

#### How to set up

Download the folder and open <a href="https://github.com/scripting/urlShortener/blob/master/config.json">config.json</a> in a text editor.

You can specify the port, the domain you're serving and the path to the create-short-url function.

1. <i>myPort</i> should be 80 if the app is running on its own server. If it's running behind another server you might want to use another port.

2. <i>rootDomain</i> is the domain you're allocating URLs from. My domain is pocalyp.se. Your domain will obviously be something else. It must point to this server via DNS using a wildcard so that all sub-domains also point to this server. 

3. <i>createPath</i> is like a password, so it should be something fairly random. If you leave it at its default value anyone who knows your domain will be able to allocate URLs. Maybe this is what you want? If so, leave it as-is. 

config.json is also where we store all the data for the server, including the URL mappings, and hit counts, etc. 

Open the file in a text editor after launching the server to see the values it initializes. And you can watch it as it the app is running through the /status endpoint.

#### Source listing

A source <a href="http://scripting.com/listings/urlshortener.html">listing</a> that preserves the outline structure of the code might be useful for some. 

#### Questions

Ask on the <a href="https://groups.google.com/forum/?fromgroups#!forum/server-snacks">server-snacks</a> mail list. 

