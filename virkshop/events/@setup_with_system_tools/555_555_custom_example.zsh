# # uncomment to add /usr/bin to your PATH inside of the virkshop
# export PATH="/usr/bin:$PATH"

# # uncomment for a small command line shortcut
alias ll="ls -l"
touch "$HOME/.zsh_history"

# Setup scons (otherwise it will be broken) this is workaround for a nix problem
export SCONS_LIB_DIR="$(dirname "$(dirname "$(which scons)")")/lib/python3.11/site-packages/scons"