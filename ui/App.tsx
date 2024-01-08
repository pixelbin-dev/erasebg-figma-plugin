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
import { PIXELBIN_IO, PIXELBIN_CONSOLE_SETTINGS } from "../config";

function App() {
	const [formValues, setFormValues] = useState<any>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isTokenSaved, setIsTokenSaved] = useState(false);
	const [tokenValue, setTokenValue] = useState(null);
	const [tokenErr, setTokenErr] = useState(false);
	const [isTokenEditOn, setIsTokenEditOn] = useState(false);
	const [isThemeDark, setIsThemeDark] = useState(false);
	const [isTokenTypePass, setIsTokenTypePass] = useState(true);

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

	useEffect(() => {
		const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)");
		setIsThemeDark(darkThemeMq.matches);
	});

	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", (event) => {
			setIsThemeDark(event.matches);
		});

	window.onmessage = async (event) => {
		const { data } = event;
		if (data.pluginMessage.type === msgTypes.IS_TOKEN_SAVED) {
			setIsTokenSaved(data.pluginMessage.value);
			if (data.pluginMessage.value)
				setTokenValue(data.pluginMessage.savedToken);
			if (data.pluginMessage.isTokenEditing) setIsTokenEditOn(true);
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
			const defaultPixelBinClient: PixelbinClient = new PixelbinClient(
				new PixelbinConfig({
					domain: `${PIXELBIN_IO}`,
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
				path: "__figma/ebg",
				name: name,
				format: "jpeg",
				access: "public-read",
				tags: ["tag1", "tag2"],
				metadata: {},
				overwrite: false,
				filenameOverride: false,
			});

			function uploadWithRetry(blob, presignedUrl, options) {
				return Pixelbin.upload(blob, presignedUrl, options)
					.then(() => {
						const url = JSON.parse(
							presignedUrl.fields["x-pixb-meta-assetdata"]
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
					.catch((err) => {
						console.log(`Retry upload`);
						return uploadWithRetry(blob, presignedUrl, options);
					});
			}

			uploadWithRetry(blob, res?.presignedUrl, {
				chunkSize: 2 * 1024 * 1024,
				maxRetries: 1,
				concurrency: 2,
			}).catch((err) => console.log("Final error:", err));
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
									<div className="generic-text dropdown-label">{obj.title}</div>
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
									<div className="generic-text">{obj.title}</div>
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

	async function handleTokenSave() {
		setTokenErr(false);
		setIsLoading(true);

		const defaultPixelBinClient: PixelbinClient = new PixelbinClient(
			new PixelbinConfig({
				domain: `${PIXELBIN_IO}`,
				apiSecret: tokenValue,
			})
		);

		PdkAxios.defaults.withCredentials = false;

		try {
			const orgDetails =
				await defaultPixelBinClient.organization.getAppOrgDetails();
			parent.postMessage(
				{
					pluginMessage: {
						type: msgTypes.SAVE_TOKEN,
						value: tokenValue,
					},
				},
				"*"
			);
			setIsLoading(false);
			setIsTokenEditOn(false);
		} catch (err) {
			setTokenErr(true);
			setIsLoading(false);
		}
	}

	function handleTokenDelete() {
		tokenValue("");
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

	function handleLinkClick(url: string) {
		parent.postMessage(
			{
				pluginMessage: {
					type: msgTypes.OPEN_EXTERNAL_URL,
					url,
				},
			},
			"*"
		);
	}

	return (
		<div
			className={`${
				isThemeDark ? "main-container-dark" : "main-container-light"
			} ${isLoading ? "hide-overflow" : ""}`}
		>
			{isTokenSaved && !isTokenEditOn ? (
				<div className="main-ui-container">
					<div>
						<div id="options-wrapper">{formComponentCreator()}</div>

						<div className="credit-details-container">
							<div className="credit-details-sub-container">
								Credits remaining : <span>20</span>
							</div>
							<div className="credit-details-sub-container">
								Credits used : <span>10</span>
							</div>
							<div
								onClick={() => {
									handleLinkClick(
										`${PIXELBIN_CONSOLE_SETTINGS}/billing/pricing`
									);
								}}
								className="buy-credits-btn"
							>
								Buy credits
							</div>
						</div>
					</div>
					<div className="bottom-btn-container">
						<div className="reset-container" id="reset" onClick={handleReset}>
							<div className="icon icon--swap icon--blue reset-icon"></div>
							<div className="reset-text">Reset all</div>
						</div>
						<button
							id="delete-token"
							onClick={handleTokenDelete}
							style={{
								color: "transparent",
								background: "transparent",
								border: "none",
								cursor: "pointer",
							}}
						>
							D
						</button>
						<button
							id="submit-btn"
							onClick={handleSubmit}
							className="button button--primary"
						>
							Apply
						</button>
					</div>
				</div>
			) : (
				<div className="api-key-ui">
					<div className="api-key-steps">
						<div>
							1. Go to
							<span
								className="link"
								onClick={() => {
									handleLinkClick(`${PIXELBIN_CONSOLE_SETTINGS}/apps`);
								}}
							>
								&nbsp;Pixelbin.io
							</span>
							<br /> and choose your organisation
						</div>
						<br />
						<div>
							2. Create new token or select the existing one , copy the active
							one and paste it here.
						</div>
						<div className="token-input-container">
							<input
								className="token-input-box"
								type={`${isTokenTypePass ? "password" : "text"}`}
								placeholder="Token here"
								onChange={(e) => {
									setTokenValue(e.target.value);
								}}
								value={tokenValue ? tokenValue : null}
							/>
							{
								<div>
									{tokenValue ? (
										isTokenTypePass ? (
											<div
												onClick={() => {
													setIsTokenTypePass(!isTokenTypePass);
												}}
												className="icon  icon--blue icon--visible"
											/>
										) : (
											<div
												onClick={() => {
													setIsTokenTypePass(!isTokenTypePass);
												}}
												className="icon  icon--blue icon--hidden
											"
											/>
										)
									) : null}
								</div>
							}
						</div>
						{tokenErr && <div className="token-err ">Invalid token.</div>}
					</div>

					<div
						className={`api-key-btn-container ${
							tokenValue ? "space-between" : "right"
						}`}
					>
						{tokenValue && (
							<div
								onClick={handleTokenDelete}
								className="delete-token-container"
							>
								<div className="icon  icon--blue icon--trash"></div>
								<div className="reset-text" style={{ fontSize: 12 }}>
									Delete token
								</div>
							</div>
						)}

						<button
							id="submit-token"
							onClick={handleTokenSave}
							className="button button--primary"
							disabled={!tokenValue}
						>
							Save
						</button>
					</div>
				</div>
			)}
			{isLoading && (
				<div className="loader-modal">
					<img src={LoaderGif} alt="Loader" height={50} width={50} />
				</div>
			)}
		</div>
	);
}

export default App;
