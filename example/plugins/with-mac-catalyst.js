const { withPodfile, withPodfileProperties } = require("@expo/config-plugins")

const POST_INSTALL_OPTION = ":mac_catalyst_enabled => true,"

function withMacCatalyst(config) {
	config = withPodfileProperties(config, (config) => {
		config.modResults["ios.buildReactNativeFromSource"] = "true"
		return config
	})

	return withPodfile(config, (config) => {
		const contents = config.modResults.contents
		if (!contents.includes(POST_INSTALL_OPTION)) {
			const anchor = "      config[:reactNativePath],\n"
			if (!contents.includes(anchor)) {
				throw new Error("Could not find react_native_post_install anchor in Podfile")
			}

			config.modResults.contents = contents.replace(anchor, `${anchor}      ${POST_INSTALL_OPTION}\n`)
		}
		return config
	})
}

module.exports = withMacCatalyst
