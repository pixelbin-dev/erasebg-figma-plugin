import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import Button from "./components/button/button";
import { PdkAxios } from "@pixelbin/admin/common.js";
import { PixelbinConfig, PixelbinClient } from "@pixelbin/admin";
import { eraseBgOptions, msgTypes } from "./../constants";
import { Util } from "./../util.ts";
import "./styles/style.scss";
import Pixelbin, { transformations } from "@pixelbin/core";
import LoaderGif from "../assets/loader.gif";

function App() {
	const [formValues, setFormValues] = useState<any>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isTokenSaved, setIsTokenSaved] = useState(false);
	const [tokenValue, setTokenValue] = useState(null);

	useEffect(() => {
		parent.postMessage(
			{
				pluginMessage: {
					type: msgTypes.INITIAL_CALL,
				},
			},
			"*"
		);
	}, []);

	window.onmessage = async (event) => {
		const { data } = event;
		if (data.pluginMessage.type === msgTypes.IS_TOKEN_SAVED) {
			setIsTokenSaved(data.pluginMessage.value);
		}
		if (data.pluginMessage.type === msgTypes.CREATE_FORM) {
			let temp = { ...formValues };
			setIsTokenSaved(true);
			eraseBgOptions.forEach((option, index) => {
				const camelCaseName = Util.camelCase(option.name);
				const savedValue = data.pluginMessage.savedFormValue[camelCaseName];

				temp[camelCaseName] =
					savedValue !== undefined && savedValue !== null
						? savedValue
						: option.default;
			});
			setFormValues({ ...temp });
		}
		if (data.pluginMessage.type === msgTypes.SELCTED_IMAGE) {
			console.log("RECEIVED VALUE", data.pluginMessage.token);

			const defaultPixelBinClient: PixelbinClient = new PixelbinClient(
				new PixelbinConfig({
					domain: "https://api.pixelbin.io",
					apiSecret: `${data.pluginMessage.token}`,
				})
			);

			PdkAxios.defaults.withCredentials = false;

			let res = null;
			let blob = new Blob([data.pluginMessage.imageBytes], {
				type: "image/jpeg",
			});

			const pixelbin = new Pixelbin({
				cloudName: "muddy-lab-41820d",
				zone: "default", // optional
			});
			const EraseBg = transformations.EraseBG;
			let name = `${data?.pluginMessage?.imageName}${uuidv4()}`;

			res = await defaultPixelBinClient.assets.createSignedUrlV2({
				path: "figma/ebg",
				name: name,
				format: "jpeg",
				access: "public-read",
				tags: ["tag1", "tag2"],
				metadata: {},
				overwrite: false,
				filenameOverride: false,
			});

			Pixelbin.upload(blob as File, res?.presignedUrl, {
				chunkSize: 2 * 1024 * 1024,
				maxRetries: 1,
				concurrency: 2,
			})
				.then(() => {
					const url = JSON.parse(
						res.presignedUrl.fields["x-pixb-meta-assetdata"]
					);
					const demoImage = pixelbin.image(url?.fileId);
					demoImage.setTransformation(EraseBg.bg(formValues));
					parent.postMessage(
						{
							pluginMessage: {
								type: msgTypes.REPLACE_IMAGE,
								bgRemovedUrl: demoImage.getUrl(),
							},
						},
						"*"
					);
				})
				.catch((err) => console.log("Error while uploading", err));
		}
		if (data.pluginMessage.type === msgTypes.TOGGLE_LOADER) {
			setIsLoading(data.pluginMessage.value);
		}
	};

	const formComponentCreator = () => {
		return (
			<div>
				{eraseBgOptions.map((obj, index) => {
					switch (obj.type) {
						case "enum":
							return (
								<div>
									<div className="white-text dropdown-label">{obj.title}</div>
									<div className="select-wrapper">
										<select
											onChange={(e) => {
												setFormValues({
													...formValues,
													[Util.camelCase(obj.name)]: e.target.value,
												});
											}}
											id={Util.camelCase(obj.name)}
											value={formValues[Util.camelCase(obj.name)]}
										>
											{obj.enum.map((option, index) => (
												<option key={index} value={option}>
													{option}
												</option>
											))}
										</select>
									</div>
								</div>
							);
						case "boolean":
							return (
								<div className="checkbox">
									<input
										id={Util.camelCase(obj.name)}
										type="checkbox"
										checked={formValues[Util.camelCase(obj.name)]}
										onChange={(e) => {
											setFormValues({
												...formValues,
												[Util.camelCase(obj.name)]: e.target.checked,
											});
										}}
									/>
									<div className="white-text">{obj.title}</div>
								</div>
							);

						default:
							return null;
					}
				})}
			</div>
		);
	};

	function handleReset() {
		let temp = { ...formValues };
		eraseBgOptions.forEach((option, index) => {
			const camelCaseName = Util.camelCase(option.name);
			temp[camelCaseName] = option.default;
		});
		setFormValues({ ...temp });
	}

	function handleTokenSave() {
		parent.postMessage(
			{
				pluginMessage: {
					type: msgTypes.SAVE_TOKEN,
					value: tokenValue,
				},
			},
			"*"
		);
	}

	function handleTokenDelete() {
		parent.postMessage(
			{
				pluginMessage: {
					type: "delete-token",
				},
			},
			"*"
		);
	}

	function handleSubmit() {
		parent.postMessage(
			{
				pluginMessage: {
					type: msgTypes.TRANSFORM,
					params: formValues,
				},
			},
			"*"
		);
	}

	return (
		<div className={`main-container ${isLoading ? "hide-overflow" : ""}`}>
			{isTokenSaved ? (
				<div className="main-ui-container">
					<div>
						<div id="options-wrapper">{formComponentCreator()}</div>
					</div>
					<div className="bottom-btn-container">
						<div className="reset-container" id="reset" onClick={handleReset}>
							<div className="icon icon--swap icon--blue reset-icon"></div>
							<div className="reset-text">Reset all</div>
						</div>
						<button
							onClick={handleTokenDelete}
							className="button button--primary"
						>
							Delete
						</button>
						<button
							id="submit-btn"
							onClick={handleSubmit}
							className="button button--primary"
						>
							Apply
						</button>
					</div>
					{isLoading && (
						<div className="loader-modal">
							<img src={LoaderGif} alt="Loader" height={50} width={50} />
						</div>
					)}
				</div>
			) : (
				<div className="api-key-ui">
					<div className="api-key-steps">
						<div>
							1. Go to <br />
							<a
								style={{ color: "#0c8ce9", textDecoration: "none" }}
								href="https://console.pixelbin.io/choose-org?redirectTo=settings/apps"
							>
								https://console.pixelbin.io/choose-org?redirectTo=settings/apps
							</a>
							<br /> and choose your organisation
						</div>
						<br />
						<div>
							2. Go to Tokens, Create new token if you dont have one or Just
							copy the active one.
						</div>
						<input
							className="token-input-box"
							type="text"
							placeholder="Token here"
							onChange={(e) => {
								setTokenValue(e.target.value);
								console.log("BEFORE PASSING, ", e.target.value);
							}}
						/>
					</div>

					<div className="api-key-btn-container">
						<button
							onClick={handleTokenDelete}
							className="button button--primary"
						>
							Delete
						</button>
						<button
							id="submit-token"
							onClick={handleTokenSave}
							className="button button--primary"
						>
							Save
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
