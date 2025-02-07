const { StatusCodes } = require("http-status-codes");
const { formatDateTime } = require("../../utils/dateUtil");
const { setSession } = require("../../utils/redis");
const { updateUser } = require("../../controllers/user.controllers");
const { uploadToS3 } = require("../../utils/uploadToS3");
const {
    sendMediaImageMessage,
    clientMainMenuTemplate
} = require("../../services/whatsappService");

class Client {
    constructor(res, userResponse, session, user, steps, messages) {
        this.res = res;
        this.userResponse = userResponse;
        this.session = session;
        this.user = user;
        this.steps = steps;
        this.messages = messages;
        this.lActivity = formatDateTime();
        this.setupCommonVariables();
    }

    setupCommonVariables() {
        const { userResponse } = this;
        this.phone = userResponse.sender.phone;
        this.message = userResponse.payload?.text || userResponse.payload || "";
        this.username = userResponse.sender.name;
    }

    async mainEntry() {
        const {
            res,
            session,
            user,
            steps,
            messages,
            lActivity,
            phone,
            username,
            message,
        } = this;

        try {
            switch (session.step) {
                case steps.SETUP_CLIENT_PROFILE:
                    return this.handlePromptAccount();
                case steps.COLLECT_CLIENT_FULL_NAME:
                    return this.handleCollectFullName();
                case steps.COLLECT_CLIENT_NATIONAL_ID:
                    return this.handleCollectNationalId();
                case steps.COLLECT_CLIENT_ID_IMAGE:
                    return this.handleCollectIdImage();
                case steps.COLLECT_CLIENT_ADDRESS:
                    return this.handleCollectAddress();
                case steps.COLLECT_CLIENT_LOCATION:
                    return this.handleCollectLocation();
                case steps.CLIENT_REGISTRATION_COMPLETE:
                    return this.handleRegistrationComplete();
                default:
                    return res
                        .status(StatusCodes.ACCEPTED)
                        .send(this.messages.DEV_IN_PROGRESS);
            }
        } catch (error) {
            console.error("Error in Client mainEntry:", error);
            return res
                .status(StatusCodes.ACCEPTED)
                .send("An error occurred. Please try again later.");
        }
    }

    async handlePromptAccount() {
        if (this.message.toString().toLowerCase() === "create account" || this.message.toString().toLowerCase().includes("1")) {
            await setSession(this.phone, {
                step: this.steps.COLLECT_CLIENT_FULL_NAME, // 👈 Transition to full name
                message: this.message,
                lActivity: this.lActivity,
            });
            return this.res.status(StatusCodes.OK).send(this.messages.GET_FULL_NAME);
        } else {
            await setSession(this.phone, {
                step: this.steps.SETUP_CLIENT_PROFILE,
                message: this.message,
                lActivity: this.lActivity,
            });
            return this.res
                .status(StatusCodes.OK)
                .send(
                    "❌ You have cancelled creating profile. If you change your mind, please type 'create account' to proceed."
                );
        }
    }

    async handleCollectFullName() {
        if (this.message.toString().length > 16) {
            return this.res
                .status(StatusCodes.OK)
                .send(
                    "❌ Name and surname provided is too long. Please re-enter your full name, name(s) first and then surname second."
                );
        }
        const userNames = this.message.toString().split(" ");
        const lastName = userNames[userNames.length - 1];
        const firstName = this.message.toString().replace(lastName, " ").trim();

        await updateUser({ phone: this.phone, firstName, lastName });
        await setSession(this.phone, {
            step: this.steps.COLLECT_CLIENT_NATIONAL_ID,
            message: this.message,
            lActivity: this.lActivity,
        });
        return this.res.status(StatusCodes.OK).send(this.messages.GET_NATIONAL_ID);
    }

    async handleCollectNationalId() {
        const pattern = /^(\d{2})-(\d{7})-([A-Z])-(\d{2})$/;
        if (!pattern.test(this.message.toString())) {
            return this.res
                .status(StatusCodes.OK)
                .send(
                    "❌ Invalid National Id format, please provide id in the format specified in the example."
                );
        }

        const nationalId = this.message.toString();
        await updateUser({ phone: this.phone, nationalId });
        await setSession(this.phone, {
            step: this.steps.COLLECT_CLIENT_ID_IMAGE,
            message: this.message,
            lActivity: this.lActivity,
        });
        return this.res.status(StatusCodes.OK).send(this.messages.UPLOAD_ID_IMAGE);
    }

    async handleCollectIdImage() {
        const nationalIdImageUrl = this.message?.url;
        if (!nationalIdImageUrl) {
            return this.res
                .status(StatusCodes.OK)
                .send("❌ Please upload a valid ID image.");
        }
        // : check content type
        const contentType = this.message?.contentType;
        if (!contentType.startsWith("image/")) {
            return this.res
                .status(StatusCodes.OK)
                .send("❌ Invalid image format. Please upload an image file.");
        }
        // : upload to AWS S3
        // const nationalIdImage = await uploadToS3(
        //     process.env.USRID_BUCKET_NAME,
        //     nationalIdImageUrl
        // );
        // // : save uploaded file
        // await updateUser(this.phone, {
        //     nationalIdImage,
        // });
        await setSession(this.phone, {
            step: this.steps.COLLECT_CLIENT_ADDRESS,
            message: this.message.toString(),
            lActivity: this.lActivity,
        });
        return this.res.status(StatusCodes.OK).send(this.messages.GET_ADDRESS);
    }

    async handleCollectAddress() {
        const street = this.message.toString();
        await updateUser({
            phone: this.phone,
            address: {
                physicalAddress: street,
            },
        });
        await setSession(this.phone, {
            step: this.steps.COLLECT_CLIENT_LOCATION,
            message: this.message,
            lActivity: this.lActivity,
        });
        const locationImgURL =
            "https://tesha-util.s3.af-south-1.amazonaws.com/WhatsApp+Image+2024-10-06+at+11.49.44_12568059.jpg";
        await sendMediaImageMessage(
            this.phone,
            locationImgURL,
            "Please share your location by tapping the location icon in WhatsApp and selecting 'Send your current location'"
        );
        return this.res.status(StatusCodes.OK).send("");
    }

    async handleCollectLocation() {
        console.log("Location:", this.message);
        if (typeof this.message !== "object") {
            return this.res
                .status(StatusCodes.OK)
                .send("❌ Invalid location format. Please send your location.");
        }
        await updateUser({
            phone: this.phone,
            address: {
                coordinates: this.message,
            },
        });
        await setSession(this.phone, {
            step: this.steps.CLIENT_REGISTRATION_COMPLETE,
            message: JSON.stringify(this.message),
            lActivity: this.lActivity,
        });

        await Promise.all([
            clientMainMenuTemplate(phone, (await getUser(phone)).firstName),
            setSession(phone, {
                step: steps.CLIENT_MAIN_MENU,
                message,
                lActivity,
            })
        ]);

        const successMessage = `*Profile Setup Confirmation*

✅ Thank you! Your profile has been successfully set up.
You're all set! If you need any further assistance, feel free to reach out. 😊`

        return this.res
            .status(StatusCodes.OK)
            .send(successMessage);
    }

    async handleRegistrationComplete() {
        // Additional logic after registration completion
        return this.res
            .status(StatusCodes.OK)
            .send("Thank you for completing your registration. You can now start using our services.");
    }
}

module.exports = Client;