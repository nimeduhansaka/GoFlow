import { Inngest } from "inngest";
import prisma from "../configs/prisma.js"

// Create a client to send and receive events
export const inngest = new Inngest({ id: "GoFlow" });

//Inngest function to save user data to a database
const syncUserCreation = inngest.createFunction(
    {id: 'sync-user-from-clerk'},
     {event: 'clerk/user.created'},
    async ( {event} ) => {
        const {data} = event
        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)


//Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
    {id: 'delete-user-with-clerk'},
    {event: 'clerk/user.deleted'},
    async ( {event} ) => {
        const {data} = event

        // Check if user exists before deleting
        const existingUser = await prisma.user.findUnique({
            where: { id: data.id }
        })

        if (existingUser) {
            await prisma.user.delete({
                where: {
                    id: data.id,
                }
            })
        } else {
            console.log(`User ${data.id} not found in database, skipping deletion`)
        }
    }
)



//Inngest function to update user from database
const syncUserUpdation = inngest.createFunction(
    {id: 'update-user-from-clerk'},
    {event: 'clerk/user.updated'},
    async ( {event} ) => {
        const {data} = event
        await prisma.user.update({
            where: {
                id: data.id,
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation
];