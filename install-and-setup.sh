# True if $1 is an executable in $PATH
# Works in both {ba,z}sh
function is_bin_in_path {
	if [[ -n $ZSH_VERSION ]]; then
		builtin whence -p "$1" &>/dev/null
	else # bash:
		builtin type -P "$1" &>/dev/null
	fi
}
function ask_yes_or_no() {
	read -p "$1 ([y]es or [N]o): "
	case $(echo $REPLY | tr '[A-Z]' '[a-z]') in
	y | yes) echo "yes" ;;
	*) echo "no" ;;
	esac
}

if ! is_bin_in_path curl; then
	echo "curl is required to install Deno. Please install it and try again."
	exit 1
fi

DENO_PATH=$(which deno)
OPT_DOWNLOAD_DENO="yes"
if is_bin_in_path "deno"; then
	echo "Deno is already installed."
	OPT_DOWNLOAD_DENO=$(ask_yes_or_no "Would you like to re-download the latest deno binary? ")
fi
if [[ "yes" == $OPT_DOWNLOAD_DENO ]]; then
	DENO_PATH=$(curl -fsSL https://deno.land/install.sh | sh | grep -oP 'Deno was installed successfully to \K[^"]+')
	$DENO_PATH run --allow-all setup.ts "$DENO_PATH"
fi

if [[ "yes" == $(ask_yes_or_no "Would you like to run the automated install for Podman and Caddy? ") ]]; then
	$DENO_PATH run --allow-all ./lib/install-deps.ts
fi

chmod +x ./*.ts
chmod +x ./lib/*.ts
