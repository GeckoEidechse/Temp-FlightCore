import { invoke } from "@tauri-apps/api";
import { listen, Event as TauriEvent } from "@tauri-apps/api/event";
import { open } from '@tauri-apps/api/dialog';
import { appDir } from '@tauri-apps/api/path';

const $ = document.querySelector.bind(document);
const button_install_string = "Install Northstar";
const button_update_string = "Update Northstar";
const button_play_string = "Launch Northstar";
const button_manual_find_string = "Manually select Titanfall2 install location";

// Stores the overall state of the application
var globalState = {
    gamepath: "",
    installed_northstar_version: "",
    current_view: "" // Note sure if this is the right way to do it
}

async function get_northstar_version_number_and_set_button_accordingly(omniButtonEl: HTMLElement) {
    let northstar_version_number = await invoke("get_northstar_version_number_caller", { gamePath: globalState.gamepath }) as string;
    if (northstar_version_number && northstar_version_number.length > 0) {
        globalState.installed_northstar_version = northstar_version_number;
        omniButtonEl.textContent = `${button_play_string} (${northstar_version_number})`;
        let northstar_is_outdated = await invoke("check_is_northstar_outdated", { gamePath: globalState.gamepath }) as boolean;
        if (northstar_is_outdated) {
            omniButtonEl.textContent = button_update_string;
        }
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

            let installLocationHolderEl = $("install-location-holder") as HTMLElement;
            installLocationHolderEl.textContent = globalState.gamepath;

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
    let installLocationHolderEl = $("install-location-holder") as HTMLElement;
    let versionNumberHolderEl = $("version-number-holder") as HTMLElement;
    let omniButtonEl = document.getElementById("omni-button") as HTMLElement;
    let hostOsHolderEl = $("host-os-holder") as HTMLElement;

    // listen backend-ping event (from Tauri Rust App)
    listen("backend-ping", function (evt: TauriEvent<any>) {
        pingEl.classList.add("on");
        setTimeout(function () {
            pingEl.classList.remove("on");
        }, 500);
    })

    // omni button click
    omniButtonEl.addEventListener("click", async function () {

        switch (omniButtonEl.textContent) {
            // Find Titanfall2 install manually
            case button_manual_find_string:
                manually_find_titanfall2_install(omniButtonEl);
                break;
            // Install Northstar
            case button_install_string:
                omniButtonEl.textContent = "Installing";
                await invoke("install_northstar_caller", { gamePath: globalState.gamepath }) as boolean;
                alert("Done?");

                get_northstar_version_number_and_set_button_accordingly(omniButtonEl);
                break;
            default:
                alert("Not implemented yet");
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
    // Get host OS
    let host_os_string = await invoke("get_host_os") as string;
    versionNumberHolderEl.textContent = `${version_number_string} (${host_os_string})`;

    // Get install location
    let install_location = await invoke("find_game_install_location_caller") as string;
    // Change omni-button content based on whether game install was found
    if (install_location && install_location.length > 0) {
        omniButtonEl.textContent = button_install_string;
        installLocationHolderEl.textContent = install_location;
        globalState.gamepath = install_location;

        // Check installed Northstar version if found
        get_northstar_version_number_and_set_button_accordingly(omniButtonEl);
        console.log(globalState);
    }
    else {
        omniButtonEl.textContent = button_manual_find_string;
    }
})
