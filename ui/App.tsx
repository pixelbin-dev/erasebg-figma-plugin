import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { PdkAxios } from "@pixelbin/admin/common.js";
import { PixelbinConfig, PixelbinClient } from "@pixelbin/admin";
import {
	eraseBgOptions,
	EVENTS,
	createSignedURlDetails,
	uploadOptions,
} from "./../constants";
import { Util } from "./../util.ts";
import "./styles/style.scss";
import Pixelbin, { transformations } from "@pixelbin/core";
import { API_PIXELBIN_IO } from "../config";
import CreditsUI from "./components/creditDetails";
import TokenUI from "./components/TokenUI";
import DynamicForm from "./components/dynamicForm";
import Loader from "./components/loader";
import Footer from "./components/mainScreenFooter/index.tsx";

PdkAxios.defaults.withCredentials = false;

function App() {
	const [formValues, setFormValues] = useState<any>({});
	const [isLoading, setIsLoading] = useState(false);
	const [isTokenSaved, setIsTokenSaved] = useState(false);
	const [tokenValue, setTokenValue] = useState(null);
	const [tokenErr, setTokenErr] = useState(false);
	const [isTokenEditOn, setIsTokenEditOn] = useState(false);
	const [creditsUsed, setCreditUSed] = useState(0);
	const [totalCredit, setTotalCredit] = useState(0);
	const [orgId, setOrgId] = useState("");

	const {
		INITIAL_CALL,
		CREATE_FORM,
		TOGGLE_LOADER,
		IS_TOKEN_SAVED,
		SAVE_TOKEN,
		TRANSFORM,
		SELCTED_IMAGE,
		REPLACE_IMAGE,
		DELETE_TOKEN,
	} = EVENTS;

	useEffect(() => {
		parent.postMessage(
			{
				pluginMessage: {
					type: INITIAL_CALL,
				},
			},
			"*"
		);
	}, []);

	function formSetter(data) {
		let temp = { ...formValues };
		eraseBgOptions.forEach((option, index) => {
			const camelCaseName = Util.camelCase(option.name);
			const savedValue = data[camelCaseName];

			temp[camelCaseName] =
				savedValue !== undefined && savedValue !== null
					? savedValue
					: option.default;
		});
		setFormValues({ ...temp });
	}

	window.onmessage = async (event) => {
		const { data } = event;
		if (data.pluginMessage.type === IS_TOKEN_SAVED) {
			setIsTokenSaved(data.pluginMessage.value);
			setIsTokenEditOn(data.pluginMessage.isTokenEditing);
			if (data.pluginMessage.value) {
				setTokenValue(data.pluginMessage.savedToken);
				formSetter(data.pluginMessage.savedFormValue);
				setOrgId(data.pluginMessage.orgId);
			}
		}
		if (data.pluginMessage.type === CREATE_FORM) {
			formSetter(data.pluginMessage.savedFormValue);
			setIsTokenEditOn(false);
			setIsTokenSaved(true);
		}

		if (data.pluginMessage.type === SELCTED_IMAGE) {
			const defaultPixelBinClient: PixelbinClient = new PixelbinClient(
				new PixelbinConfig({
					domain: `${API_PIXELBIN_IO}`,
					apiSecret: `${data.pluginMessage.token}`,
					integrationPlatform: Util.generateUserAgent(),
				})
			);

			let res = null;
			let blob = new Blob([data.pluginMessage.imageBytes], {
				type: "image/jpeg",
			});

			var pixelbin = new Pixelbin({
				cloudName: `${data.pluginMessage.savedCloudName}`,
				zone: "default", // optional
			});

			const EraseBg = transformations.EraseBG;
			let name = `${data?.pluginMessage?.imageName}${uuidv4()}`;

			res = await defaultPixelBinClient.assets.createSignedUrlV2({
				...createSignedURlDetails,
				name: name,
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
									type: REPLACE_IMAGE,
									bgRemovedUrl: demoImage.getUrl(),
								},
							},
							"*"
						);
						setCreditsDetails();
					})
					.catch((err) => {
						return uploadWithRetry(blob, presignedUrl, options);
					});
			}

			uploadWithRetry(blob, res?.presignedUrl, uploadOptions).catch((err) =>
				console.log("Final error:", err)
			);
		}
		if (data.pluginMessage.type === TOGGLE_LOADER)
			setIsLoading(data.pluginMessage.value);
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
				domain: `${API_PIXELBIN_IO}`,
				apiSecret: tokenValue,
				integrationPlatform: Util.generateUserAgent(),
			})
		);

		try {
			const orgDetails =
				await defaultPixelBinClient.organization.getAppOrgDetails();
			setOrgId(orgDetails?.app?.orgId);
			parent.postMessage(
				{
					pluginMessage: {
						type: SAVE_TOKEN,
						value: tokenValue,
						cloudName: orgDetails?.org?.cloudName,
						orgId: orgDetails?.app?.orgId,
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
		setTokenValue(null);
		parent.postMessage(
			{
				pluginMessage: {
					type: DELETE_TOKEN,
				},
			},
			"*"
		);
	}

	function handleSubmit() {
		parent.postMessage(
			{
				pluginMessage: {
					type: TRANSFORM,
					params: formValues,
				},
			},
			"*"
		);
	}

	async function setCreditsDetails() {
		if (tokenValue && tokenValue !== null) {
			const defaultPixelBinClient: PixelbinClient = new PixelbinClient(
				new PixelbinConfig({
					domain: `${API_PIXELBIN_IO}`,
					apiSecret: `${tokenValue}`,
					integrationPlatform: Util.generateUserAgent(),
				})
			);

			try {
				const usage = await defaultPixelBinClient.billing.getUsageV2();
				const creditsUsed = usage?.credits?.used;
				const totalCredits = usage?.credits?.total;
				setCreditUSed(creditsUsed);
				setTotalCredit(totalCredits);
			} catch (err) {
				console.log("error", err);
			}
		}
	}

	useEffect(() => {
		setCreditsDetails();
	}, [tokenValue]);

	return (
		<div className={`main-container ${isLoading ? "hide-overflow" : ""}`}>
			{isTokenSaved && !isTokenEditOn ? (
				<div className="main-ui-container">
					<div>
						<div id="options-wrapper">
							<DynamicForm
								setFormValues={setFormValues}
								formValues={formValues}
							/>
						</div>
						<CreditsUI
							totalCredit={totalCredit}
							creditUSed={creditsUsed}
							orgId={orgId}
						/>
					</div>
					<Footer
						handleReset={handleReset}
						handleSubmit={handleSubmit}
						isBtnDisabled={totalCredit === 0 || creditsUsed >= totalCredit}
					/>
				</div>
			) : (
				<TokenUI
					tokenValue={tokenValue}
					tokenErr={tokenErr}
					setTokenValue={setTokenValue}
					handleTokenDelete={handleTokenDelete}
					handleTokenSave={handleTokenSave}
				/>
			)}
			{isLoading && <Loader />}
		</div>
	);
}

export default App;
