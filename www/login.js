// A (non-cryptographically secure!) digest of the current session.
async function GetSessionId() {
	const salt = Math.random() * 1000;
	const nonce = window.navigator.userAgent + " x " + salt.toString();
	const data = new TextEncoder().encode(nonce);
	const hash = await crypto.subtle.digest("SHA-256", data);

	// See MDN docs on SubtleCrypto -> digest().
	const display = Array.from(new Uint8Array(hash))
		.slice(0, 8) // only take first 8 uint_8s
		.map((b) => b.toString(16))
		.join("");
	return display;
}

// Interactivity to attach once the page is loaded.
document.addEventListener("DOMContentLoaded", async () => {
	// "Auth state" stores the "state" variable used to mitigate against
	// CSRF attacks, and "auth resume" stores the page to redirect to once
	// the login process finishes.
	// Although the name, icon, and rank are cached, these are re-fetched
	// on every page load, since they may get updated.
	// Irene exchanges the discord auth code for a token (hash), used to
	// link a session to a logged in user. The expiration of the corresponding
	// discord access token is also returned as the expiry, and the user
	// should be logged out after this point.
	const key_authState  = "discordAuthState";
	const key_authResume = "discordAuthResume";
	const key_token  = "guildToken";
	const key_expiry = "guildExpiry";
	const key_name   = "guildName";
	const key_icon   = "guildIcon";
	const key_rank   = "guildRank";

	const node_accountPill = document.getElementById("account-pill");
	const node_accountPillBadge = document.getElementById("account-pill-badge");
	const node_accountPillLogout = document.getElementById("account-pill-logout");
	const node_accountIcon = node_accountPill.querySelector(".badge-icon");
	const node_accountName = node_accountPill.querySelector(".badge-name");
	const node_accountLogout = node_accountPillLogout.querySelector(".logout-button");

	// In order for a user to be logged in, they must have both a set token,
	// and it must be unexpired.
	function IsLoggedIn() {
		const timestamp = sessionStorage.getItem(key_expiry);
		const expiry = new Date(timestamp);
		if (expiry < Date.now()) {
			return false;
		}
		return sessionStorage.getItem(key_loggedIn) !== null;
	}

	// Update the account pill with text and an icon.
	// This is a low level function that only does these two things, and
	// should only be used by the `SetLoggedIn`/`Out` functions.
	function UpdateAccountDisplay(name, iconUrl) {
		node_accountName.innerText = name;
		node_accountIcon.setAttribute("src", iconUrl);
	}

	function SetLoggedIn() {
		const name = sessionStorage.getItem(key_name);
		const icon = sessionStorage.getItem(key_icon);

		node_accountPill.classList.remove("account-guest");
		UpdateAccountDisplay(name, icon);
		node_accountPillLogout.style.display = "inline-flex";
		node_accountLogout.setAttribute("tabindex", "0");
	}
	function SetLoggedOut() {
		sessionStorage.removeItem(key_token);
		sessionStorage.removeItem(key_expiry);
		sessionStorage.removeItem(key_name);
		sessionStorage.removeItem(key_icon);
		sessionStorage.removeItem(key_rank);

		node_accountPill.classList.add("account-guest");
		UpdateAccountDisplay("Log in", "/rc/button-user.svg");
		node_accountPillLogout.style.display = "none";
		node_accountLogout.removeAttribute("tabindex");
	}

	// Fetching user data requires a valid token to be submitted, which
	// is assigned through the `web-auth/log-in` endpoint.
	// see: `login-redirect.js`
	// NOTE: Assumes user is already logged in.
	async function FetchUserData() {
		const endpoint = "https://api.erythro.org/irene/web-auth/user-info";
		const body = { code: sessionStorage.getItem(key_code) };
		const request = new Request(endpoint, {
			method: "POST",
			body: JSON.stringify(body),
		});
		const data = (await fetch(request)).json();

		sessionStorage.setItem(key_name, data.name);
		sessionStorage.setItem(key_icon, data.icon);
		sessionStorage.setItem(key_rank, data.rank);
	}

	// Only submits the logout request; does not update any resources on
	// the client's side. (Call `SetLoggedOut()` after.)
	async function RequestLogOut() {
		const endpoint = "https://api.erythro.org/irene/web-auth/log-out";
		const body = { code: sessionStorage.getItem(key_code) };
		const request = new Request(endpoint, {
			method: "POST",
			body: JSON.stringify(body),
		});
		await fetch(request);
	}



	// Set initial page state on load.
	if (IsLoggedIn()) {
		await FetchUserData();
		SetLoggedIn();
	} else {
		await RequestLogOut();
		SetLoggedOut();
	}

	// Handle logout click.
	node_accountLogout.addEventListener("click", async () => {
		await RequestLogOut();
		SetLoggedOut();
	});

	// Handle clicks on the account pill (badge), depending on whether the
	// user is currently logged in or not.
	node_accountPillBadge.addEventListener("click", async () => {
		if (IsLoggedIn()) {
			// Only attach listener when dropdown is active.
			// (These need to be declared ahead of time for that.)
			const outsideClickListener = e => {
				// This listener checks ONLY for closing clicks from outside
				// the account pill; clicking the account pill also closes
				// the dropdown and should be handled separately.
				// NOTE: Remember to remove the listener for that case!
				if (!node_accountPill.contains(e.target)) {
					node_accountPillLogout.classList.remove("pill-open");
					removeClickListener();
				}
			}
			const removeClickListener = () =>
				document.removeEventListener("click", outsideClickListener);

			// Set up listener before updating the visible UI.
			// We are checking if the logout node has NOT dropped down yet,
			// i.e. it is about to.
			if (!node_accountPillLogout.classList.contains("pill-open")) {
				document.addEventListener("click", outsideClickListener);
			}

			// Update the dropdown (via CSS animation).
			node_accountPillLogout.classList.toggle("pill-open");

			// Remove click listener if dropdown was closed by clicking
			// on the pill a second time (listener wouldn't have triggered),
			// so it won't remove itself automatically.
			if (!node_accountPillLogout.classList.contains("pill-open")) {
				removeClickListener();
			}
		} else {
			// Generate a token to prevent CSRF attacks.
			const state = await GetSessionId();
			sessionStorage.setItem(key_authState, state);

			// Save the current page to resume to after login.
			const resume = window.location.href;
			sessionStorage.setItem(key_authResume, resume);

			// Navigate to Discord authentication.
			const clientId = "609752546994683911";
			const redirectUrl = window.location.protocol + "//" +
				window.location.host + "/" + "login.html";
			const url = "https://discord.com/oauth2/authorize" +
				"?response_type=code" + "&prompt=consent" +
				"&client_id=" + clientId +
				"&scope=identify" +
				"&state=" + state +
				"&redirect_uri=" + encodeURI(redirectUrl);
				// `response_type=code` is the more secure authentication
				// flow, and since we'll need to query Irene's API to fetch
				// data anyway (can't do it in browser due to CORS safeguards),
				//  might as well use it.
				// `prompt=consent` force shows the authentication screen,
				// which is what we want because it allows the user to select
				// which account to connect.
			window.location = url;
		}
	});
});
