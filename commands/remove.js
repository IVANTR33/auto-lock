const { PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'remove',
    description: 'Elimina Pokémon de la lista blanca.',
    async execute(client, message, args, { whitelistPublic, whitelistPrivate, whitelistPublicPath, whitelistPrivatePath, loadWhitelists }) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Se requieren permisos de administrador.');
        }

        if (args.length < 2) {
            return message.reply('❌ Uso: `!remove <public|private> <nombre1, nombre2, ...>`');
        }

        const listType = args[0].toLowerCase();
        const validPrivate = ['priv', 'private', 'privado', 'pv'];
        const validPublic = ['pub', 'public', 'publica', 'pb'];

        let targetSet, targetPath, listName;

        if (validPrivate.includes(listType)) {
            targetSet = whitelistPrivate;
            targetPath = whitelistPrivatePath;
            listName = 'privada';
        } else if (validPublic.includes(listType)) {
            targetSet = whitelistPublic;
            targetPath = whitelistPublicPath;
            listName = 'pública';
        } else {
            return message.reply('❌ Tipo de lista inválido. Usa `public` o `private`.');
        }

        const pokemons = args.slice(1).join(' ').split(',').map(p => p.trim().toLowerCase()).filter(p => p.length > 0);

        if (pokemons.length === 0) {
            return message.reply('❌ Proporciona al menos un nombre válido.');
        }

        const removed = [];
        const notFound = [];

        pokemons.forEach(pokemon => {
            if (targetSet.delete(pokemon)) {
                removed.push(pokemon);
            } else {
                notFound.push(pokemon);
            }
        });

        if (removed.length > 0) {
            fs.writeFileSync(targetPath, JSON.stringify([...targetSet], null, 2));
            loadWhitelists(); // Recargar las listas
        }

        let reply = '';
        if (removed.length > 0) {
            reply += `✅ Eliminado(s) de la lista ${listName}: ${removed.join(', ')}\n`;
        }
        if (notFound.length > 0) {
            reply += `ℹ️ No encontrados: ${notFound.join(', ')}`;
        }

        message.reply(reply);
    },
};