document.addEventListener("DOMContentLoaded", () => {
	const key_loggedIn = "isLoggedIn";
	const key_authState = "discordAuthState";
	const key_authResume = "discordAuthResume";
	const key_code = "discordCode";
	const key_name = "discordName";
	const key_icon = "discordIcon";

	// Parse returned data.
	const response = new URLSearchParams(window.location.search);

	// Figure out where to redirect to.
	// If unknown, redirect to homepage.
	let redirect = sessionStorage.getItem(key_authResume);
	if (redirect === null) {
		redirect = window.location.host;
	}

	// Check to see if authentication was valid.
	let didAuthSucceed = true;
	
	const state = sessionStorage.getItem(key_authState);
	if (state === null || state != response.get("state")) {
		didAuthSucceed = false;
	}

	if (response.has("error")) {
		didAuthSucceed = false;
	}

	// Set session storage based on authentication validity,
	if (!didAuthSucceed) {
		sessionStorage.removeItem(key_loggedIn);
		sessionStorage.removeItem(key_code);
		sessionStorage.removeItem(key_name);
		sessionStorage.removeItem(key_icon);
	} else {
		sessionStorage.setItem(key_loggedIn, "true");
		sessionStorage.setItem(key_code, response.get("code"));
	}

	// Redirect based on previously-determined location.
	window.location.href = redirect;
});
