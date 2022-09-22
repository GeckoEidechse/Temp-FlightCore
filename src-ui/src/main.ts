import { invoke } from "@tauri-apps/api";
import { listen, Event as TauriEvent } from "@tauri-apps/api/event";
import { open } from '@tauri-apps/api/dialog';
import { appDir } from '@tauri-apps/api/path';
import { Store } from 'tauri-plugin-store-api';

const store = new Store('flight-core-settings.json');

const $ = document.querySelector.bind(document);
const button_install_string = "Install Northstar";
const button_in_install_string = "Installing...";
const button_update_string = "Update Northstar";
const button_in_update_string = "Updating...";
const button_play_string = "Launch Northstar";
const button_launched_string = "Launched Northstar";
const button_manual_find_string = "Manually select Titanfall2 install location";

interface GameInstall {
    game_path: string;
    install_type: string;
}

// Stores the overall state of the application
var globalState = {
    gamepath: "",
    installed_northstar_version: "",
    northstar_package_name: "Northstar",
    current_view: "" // Note sure if this is the right way to do it
}

async function get_northstar_version_number_and_set_button_accordingly(omniButtonEl: HTMLElement) {
    let northstar_version_number = await invoke("get_northstar_version_number_caller", { gamePath: globalState.gamepath }) as string;
    if (northstar_version_number && northstar_version_number.length > 0) {
        globalState.installed_northstar_version = northstar_version_number;

        // Show installed Northstar version
        let northstarVersionHolderEl = $("northstar-version-holder") as HTMLElement;
        northstarVersionHolderEl.textContent = `Installed Northstar version: v${globalState.installed_northstar_version}`;

        omniButtonEl.textContent = button_play_string;
        await invoke("check_is_northstar_outdated", { gamePath: globalState.gamepath, northstarPackageName: globalState.northstar_package_name })
            .then((message) => {
                console.log(message);
                if (message) {
                    omniButtonEl.textContent = button_update_string;
                }
            })
            .catch((error) => {
                console.error(error);
                alert(error);
            });
    }
}

async function manually_find_titanfall2_install(omniButtonEl: HTMLElement) {
    // Open a selection dialog for directories
    const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: await appDir(),
    });
    if (Array.isArray(selected)) {
        // user selected multiple directories
        alert("Please only select a single directory");
    } else if (selected === null) {
        // user cancelled the selection
    } else {
        // user selected a single directory

        // Verify if valid Titanfall2 install location
        let is_valid_titanfall2_install = await invoke("verify_install_location", { gamePath: selected }) as boolean;
        if (is_valid_titanfall2_install) {
            globalState.gamepath = selected;

            let installLocationHolderEl = document.getElementById("install-location-holder") as HTMLInputElement;
            installLocationHolderEl.value = globalState.gamepath;

            // Update omni-button
            omniButtonEl.textContent = button_install_string;

            // Check for Northstar install
            await get_northstar_version_number_and_set_button_accordingly(omniButtonEl);
        }
        else {
            // Not valid Titanfall2 install
            alert("Not a valid Titanfall2 install");
        }
    }
}

document.addEventListener("DOMContentLoaded", async function () {
    // get the elements
    // const helloEl = $("div.hello")! as HTMLElement;
    // let counterButtonEl = $("counter-button") as HTMLElement;
    // let counterResultEl = $("counter-result") as HTMLElement;
    let pingEl = $("backend-ping")! as HTMLElement;
    let panicButtonEl = $("panic-button") as HTMLElement;
    let installLocationHolderEl = document.getElementById("install-location-holder") as HTMLInputElement;
    let versionNumberHolderEl = $("version-number-holder") as HTMLElement;
    let installTypeHolderEl = $("install-type-holder") as HTMLElement;
    let omniButtonEl = document.getElementById("omni-button") as HTMLElement;
    let originRunningHolderEl = $("origin-running-holder") as HTMLElement;
    let northstarVersionHolderEl = $("northstar-version-holder") as HTMLElement;
    let useReleaseCandidateCheckboxEl = document.getElementById("use-release-candidate-checkbox") as HTMLInputElement;

    useReleaseCandidateCheckboxEl.addEventListener('change', async function () {
        // Switch between main release and release candidates
        if (this.checked) {
            globalState.northstar_package_name = "NorthstarReleaseCandidate"
        } else {
            globalState.northstar_package_name = "Northstar";
        }
        // Update the button
        get_northstar_version_number_and_set_button_accordingly(omniButtonEl);
 
        // Save change in persistent store
        await store.set('northstar-package-name', { value: globalState.northstar_package_name });
    });

    // listen backend-ping event (from Tauri Rust App)
    listen("backend-ping", function (evt: TauriEvent<any>) {
        pingEl.classList.add("on");
        setTimeout(function () {
            pingEl.classList.remove("on");
        }, 500);
    })

    // listen origin-running-ping event (from Tauri Rust App)
    listen("origin-running-ping", function (evt: TauriEvent<any>) {
        let origin_is_running = evt.payload as boolean;
        if (origin_is_running) {
            originRunningHolderEl.textContent = "ORIGIN RUNNING";
        }
        else {
            originRunningHolderEl.textContent = "ORIGIN NOT RUNNING";
        }
        console.log(evt.payload);
    });

    // listen northstar-running-ping event (from Tauri Rust App)
    listen("northstar-running-ping", function (evt: TauriEvent<any>) {
        let northstar_is_running = evt.payload as boolean;
        if (northstar_is_running) {
            omniButtonEl.textContent = button_launched_string;
        }
        else {
            // Only set button to launch Northstar if was running before
            // Otherwise we'd have to check on each access if Titanfall2 path set, Northstar is installed, etc.
            if (omniButtonEl.textContent == button_launched_string) {
                omniButtonEl.textContent = button_play_string;
            }
        }
        console.log(evt.payload);
    });

    // omni button click
    omniButtonEl.addEventListener("click", async function () {

        switch (omniButtonEl.textContent) {

            // Find Titanfall2 install manually
            case button_manual_find_string:
                manually_find_titanfall2_install(omniButtonEl);
                break;

            // Install Northstar
            case button_install_string:
                let install_northstar_result = invoke("install_northstar_caller", { gamePath: globalState.gamepath, northstarPackageName: globalState.northstar_package_name });

                // Update button while installl process is run
                omniButtonEl.textContent = button_in_install_string;

                await install_northstar_result.then((message) => {
                    console.log(message);
                })
                    .catch((error) => {
                        console.error(error);
                        alert(error);
                    });

                get_northstar_version_number_and_set_button_accordingly(omniButtonEl);
                break;

            // Update Northstar
            case button_update_string:
                let update_northstar_result = invoke("update_northstar_caller", { gamePath: globalState.gamepath, northstarPackageName: globalState.northstar_package_name });

                // Update button while update process is run
                omniButtonEl.textContent = button_in_update_string;

                await update_northstar_result.then((message) => {
                    console.log(message);
                })
                    .catch((error) => {
                        console.error(error);
                        alert(error);
                    });

                // Update button to display new version
                get_northstar_version_number_and_set_button_accordingly(omniButtonEl);
                break;

            // Launch Northstar
            case button_play_string:
                let game_install = {
                    game_path: globalState.gamepath,
                    install_type: installTypeHolderEl.textContent
                } as GameInstall;
                await invoke("launch_northstar_caller", { gameInstall: game_install })
                    .then((message) => {
                        console.log(message);
                        omniButtonEl.textContent = button_launched_string;
                    })
                    .catch((error) => {
                        console.error(error);
                        alert(error);
                    });
                break;

            // Do nothing when clicked during install/update/game-launched
            case button_in_update_string:
            case button_in_install_string:
            case button_launched_string:
                break;

            // Fallback
            default:
                alert(`Not implemented yet: ${omniButtonEl.textContent}`);
                break;
        }
    });

    // // counter button click
    // counterButtonEl.addEventListener("pointerup", async function () {
    //     const result = await invoke("add_count", { num: 1 }) as string;
    //     counterResultEl.textContent = result;
    // });

    // // hello click
    // helloEl.addEventListener("pointerup", async function () {
    //     const result = await invoke("hello_world") as string;
    //     helloEl.textContent = result;
    //     setTimeout(function () {
    //         helloEl.textContent = "Click again";
    //     }, 1000);
    // })

    // panic button click
    panicButtonEl.addEventListener("pointerup", async function () {
        await invoke("force_panic");
        alert("Never should have been able to get here!");
    });

    // Run the following on initial page load
    // Get version number
    let version_number_string = await invoke("get_version_number") as string;
    // Check if up-to-date
    let flightcore_is_outdated = await invoke("check_is_flightcore_outdated_caller") as boolean;
    let outdated_string = flightcore_is_outdated ? " (outdated, please update FlightCore)" : "";
    // Get host OS
    let host_os_string = await invoke("get_host_os_caller") as string;
    versionNumberHolderEl.textContent = `${version_number_string} (${host_os_string})${outdated_string}`;

    // Get preferred Northstar version from persistent store
    const persistent_northstar_package_name_obj = ((await store.get('northstar-package-name')) as any);
    if (persistent_northstar_package_name_obj) {
        console.log(persistent_northstar_package_name_obj)
        globalState.northstar_package_name = persistent_northstar_package_name_obj.value as string;
        // Update checkbox if it's a ReleaseCandidate
        // In the future this might be a dropdown menu instead
        if (globalState.northstar_package_name === "NorthstarReleaseCandidate") {
            useReleaseCandidateCheckboxEl.checked = true;
        }
    }

    // Get install location
    await invoke("find_game_install_location_caller", { gamePath: globalState.gamepath })
        .then((game_install) => {
            // Found some gamepath

            console.log(game_install);

            let game_install_obj = game_install as GameInstall;

            // Change omni-button content based on whether game install was found
            omniButtonEl.textContent = button_install_string;

            installLocationHolderEl.value = game_install_obj.game_path;
            globalState.gamepath = game_install_obj.game_path;

            installTypeHolderEl.textContent = game_install_obj.install_type;

            // Check installed Northstar version if found
            get_northstar_version_number_and_set_button_accordingly(omniButtonEl);
            console.log(globalState);

        })
        .catch((error) => {
            // Gamepath not found or other error
            console.error(error);
            alert(error);
            omniButtonEl.textContent = button_manual_find_string;
        });


    // --- This should be moved and is only placed here temporarily -----
    let game_install = {
        game_path: globalState.gamepath,
        install_type: installTypeHolderEl.textContent
    } as GameInstall;
    await invoke("get_log_list_caller", { gameInstall: game_install })
        .then((message) => {
            console.log(message);
        })
        .catch((error) => {
            console.error(error);
        });
    // ------------------------------------------------------------------

})
