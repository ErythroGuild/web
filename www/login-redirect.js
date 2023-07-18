document.addEventListener("DOMContentLoaded", async () => {
	const key_authState  = "discordAuthState";
	const key_authResume = "discordAuthResume";
	const key_token  = "guildToken";
	const key_expiry = "guildExpiry";
	const key_name   = "guildName";
	const key_icon   = "guildIcon";
	const key_rank   = "guildRank";

	function RemoveLoginData() {
		sessionStorage.removeItem(key_token );
		sessionStorage.removeItem(key_expiry);
		sessionStorage.removeItem(key_name  );
		sessionStorage.removeItem(key_icon  );
		sessionStorage.removeItem(key_rank  );
	}

	// Parse returned data.
	const responseDiscord = new URLSearchParams(window.location.search);

	// Figure out where to redirect to.
	// If unknown, redirect to homepage.
	let redirect = sessionStorage.getItem(key_authResume);
	if (redirect === null) {
		redirect = window.location.host;
	}

	// Check to see if authentication was valid.
	let didAuthSucceed = true;
	
	const state = sessionStorage.getItem(key_authState);
	if (state === null || state != responseDiscord.get("state")) {
		didAuthSucceed = false;
	}

	if (responseDiscord.has("error")) {
		didAuthSucceed = false;
	}

	// Redirect immediately if authentication wasn't even valid.
	// No need to show login screen here because either the login was cancelled,
	// forged, or there was an attempted CSRF (not initiated by the user).
	if (!didAuthSucceed) {
		RemoveLoginData();
		window.location.href = redirect;
	}

	// Log in and fetch a valid token.
	// (Actually populating the rest of the data happens on page load.)
	const endpoint = "https://api.erythro.org/irene/web-auth/login";
	const oauthCode = responseDiscord.get("code");
	const request = new Request(endpoint, {
		method: "POST",
		body: oauthCode,
	});
	const responseIrene = await fetch(request);

	// Assume request succeeds--handling timeouts is non-trivial and would
	// require a better way to surface error messages to the user.
	if (!responseIrene.ok) {
		window.location.href = redirect;
	}
	const loginData = await responseIrene.body.json();

	// Depending on if login succeeded, either display an error message
	// or parse the response and redirect back to the resume page.
	if (!loginData["isUserUnknown"]) {
		sessionStorage.setItem(key_token , loginData[key_token ]);
		sessionStorage.setItem(key_expiry, loginData[key_expiry]);
		window.location.href = redirect;
	} else {
		document.getElementById("discord-banner")
			.setAttribute("src", loginData["discordBanner"]);
		document.getElementById("discord-pfp")
			.setAttribute("src", loginData["discordPfp"]);
		document.getElementById("discord-displayname")
			.innerText = loginData["discordDisplayname"];
		document.getElementById("discord-handle")
			.innerText = loginData["discordHandle"];

		document.getElementById("error-action-resume")
			.setAttribute("href", )

		// Display error message once all fields have been populated.
		const node_main = document.querySelector("main");
		node_main.removeAttribute("hidden");
	}
});
