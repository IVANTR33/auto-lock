const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'list',
    description: 'Muestra la lista de Pokémon permitidos (pública, privada o ambas).',

    async execute(client, message, args, { whitelistPublic, whitelistPrivate, paginationStates, generatePaginationButtons }) {
        const listType = args[0]?.toLowerCase();
        const validPrivate = ['pv', 'priv', 'privado', 'private'];
        const validPublic = ['pb', 'pub', 'public', 'publica'];

        let pokemonList, title;

        if (validPrivate.includes(listType)) {
            pokemonList = [...whitelistPrivate].map(p => ({ name: p, type: 'Privada' }));
            title = '📋 Pokémon Permitidos (Lista Privada)';
        } else if (validPublic.includes(listType)) {
            pokemonList = [...whitelistPublic].map(p => ({ name: p, type: 'Pública' }));
            title = '📋 Pokémon Permitidos (Lista Pública)';
        } else if (!listType) {
            pokemonList = [
                ...[...whitelistPublic].map(p => ({ name: p, type: 'Pública' })),
                ...[...whitelistPrivate].map(p => ({ name: p, type: 'Privada' }))
            ];
            title = '📋 Pokémon Permitidos (Todas las listas)';
        } else {
            return message.reply('❌ Tipo de lista inválido. Usa `public` o `private`.');
        }

        pokemonList.sort((a, b) => a.name.localeCompare(b.name));

        if (pokemonList.length === 0) {
            return message.reply('📭 La lista está vacía');
        }

        const itemsPerPage = 25;
        const totalPages = Math.ceil(pokemonList.length / itemsPerPage);

        const generateEmbed = (currentPage) => {
            const start = currentPage * itemsPerPage;
            const end = start + itemsPerPage;
            const currentItems = pokemonList.slice(start, end);

            let description = currentItems.map((item, index) =>
                `${start + index + 1}. ${item.name} (${item.type})`
            ).join('\n');

            return new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${title} (${pokemonList.length})`)
                .setDescription(description || '`No hay Pokémon en la lista`')
                .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });
        };

        const initialState = {
            currentPage: 0,
            pokemonList,
            itemsPerPage,
            totalPages,
            title,
            messageAuthorId: message.author.id,
            commandName: 'list' // NECESARIO para que interactionCreate sepa qué comando es
        };

        const reply = await message.reply({
            embeds: [generateEmbed(initialState.currentPage)],
            components: [generatePaginationButtons(initialState.currentPage, totalPages, 'list_')],
            fetchReply: true
        });

        paginationStates.set(reply.id, initialState);
    },

    handlePagination: async (interaction, state, generatePaginationButtons) => {
        if (interaction.customId.includes('_close_list')) return interaction.message.delete().catch(() => {});
        
        if (interaction.user.id !== state.messageAuthorId) {
            return interaction.reply({
                content: '❌ Solo el autor del comando puede interactuar con esta paginación.',
                ephemeral: true
            });
        }

        if (interaction.customId === 'list_prev_page' && state.currentPage > 0) {
            state.currentPage--;
        } else if (interaction.customId === 'list_next_page' && state.currentPage < state.totalPages - 1) {
            state.currentPage++;
        } else if (interaction.customId === 'list_close_list') {
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => interaction.update({ components: [] }));
        }

        const start = state.currentPage * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const currentItems = state.pokemonList.slice(start, end);
        
        const description = currentItems.map((item, index) =>
            `${start + index + 1}. ${item.name} (${item.type})`
        ).join('\n');
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${state.title} (${state.pokemonList.length})`)
            .setDescription(description || '`No hay Pokémon en la lista`')
            .setFooter({ text: `Página ${state.currentPage + 1} de ${state.totalPages}` });

        await interaction.update({
            embeds: [embed],
            components: [generatePaginationButtons(state.currentPage, state.totalPages, 'list_')]
        });
    }
};